import { Inject, Injectable, Logger, OnModuleInit, BadRequestException, ForbiddenException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHmac } from 'crypto';
import Redis from 'ioredis';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { Business } from '../../database/entities/business.entity';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { randomToken } from '../../common/crypto/hash.util';

const FB_OAUTH_SCOPES = ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'];
const STATE_TTL_SECONDS = 600;

export interface FbPageBasic {
  fbPageId: string;
  pageName: string;
  pictureUrl: string | null;
}

interface FbState {
  userId: string;
  businessId: string;
  nonce: string;
  iat: number;
  exp: number;
}

@Injectable()
export class FacebookService implements OnModuleInit {
  private readonly logger = new Logger(FacebookService.name);
  private appId = '';
  private appSecret = '';
  private redirectUri = '';
  private graphVersion = 'v19.0';
  private stateSecret = '';

  constructor(
    private configService: ConfigService,
    private encryptionService: EncryptionService,
    @Inject('REDIS_CLIENT') private redis: Redis,
    @InjectRepository(FacebookPage) private pageRepo: Repository<FacebookPage>,
    @InjectRepository(Business) private businessRepo: Repository<Business>,
  ) {}

  onModuleInit(): void {
    this.appId = this.configService.get<string>('app.facebook.appId') || '';
    this.appSecret = this.configService.get<string>('app.facebook.appSecret') || '';
    this.redirectUri = this.configService.get<string>('app.facebook.redirectUri') || '';
    this.graphVersion = this.configService.get<string>('app.facebook.graphVersion') || 'v19.0';
    this.stateSecret = this.configService.get<string>('app.jwt.accessSecret') || '';
    if (!this.appId || !this.appSecret) {
      this.logger.warn('FB_APP_ID/FB_APP_SECRET not set; Facebook OAuth endpoints will be disabled');
    } else {
      this.logger.log(`Facebook OAuth configured (appId=${this.appId}, graph=${this.graphVersion})`);
    }
  }

  isConfigured(): boolean {
    return Boolean(this.appId && this.appSecret);
  }

  async buildOAuthUrl(userId: string, businessId: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new BadRequestException({
        message: 'Facebook app credentials not configured',
        error: 'fb_not_configured',
      });
    }
    const business = await this.businessRepo.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException({ message: 'Business not found', error: 'not_found' });
    }
    if (business.ownerId !== userId) {
      throw new ForbiddenException({ message: 'Not business owner', error: 'forbidden' });
    }
    const state = this.signState(userId, businessId);
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      state,
      scope: FB_OAUTH_SCOPES.join(','),
      response_type: 'code',
    });
    return `https://www.facebook.com/${this.graphVersion}/dialog/oauth?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ businessId: string; userId: string }> {
    const decoded = this.verifyState(state);
    if (!decoded) {
      throw new UnauthorizedException({ message: 'Invalid OAuth state', error: 'invalid_state' });
    }
    const tokenRes = await this.graphPost('oauth/access_token', {
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: this.redirectUri,
      code,
    });
    const shortUserToken = (tokenRes as { access_token?: string }).access_token;
    if (!shortUserToken) {
      throw new UnauthorizedException({
        message: 'Failed to obtain Facebook user token',
        error: 'fb_token_exchange_failed',
      });
    }
    const longRes = await this.graphGet('oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortUserToken,
    });
    const longUserToken = (longRes as { access_token?: string }).access_token ?? shortUserToken;

    await this.redis.set(
      this.fbTokenKey(decoded.userId, decoded.businessId),
      longUserToken,
      'EX',
      STATE_TTL_SECONDS,
    );
    return { businessId: decoded.businessId, userId: decoded.userId };
  }

  async listPagesForUser(userId: string, businessId: string): Promise<FbPageBasic[]> {
    const token = await this.getCachedUserToken(userId, businessId);
    const pages = await this.fetchUserPages(token);
    return pages.map((p) => ({ fbPageId: p.id, pageName: p.name, pictureUrl: p.pictureUrl }));
  }

  async connectPage(
    userId: string,
    businessId: string,
    fbPageId: string,
  ): Promise<FacebookPage> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId, deletedAt: IsNull() },
    });
    if (!business) {
      throw new NotFoundException({ message: 'Business not found', error: 'not_found' });
    }
    const token = await this.getCachedUserToken(userId, businessId);
    const pages = await this.fetchUserPages(token);
    const match = pages.find((p) => p.id === fbPageId);
    if (!match) {
      throw new NotFoundException({
        message: 'Page not visible to this user',
        error: 'fb_page_not_found',
      });
    }
    const expiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000);
    const encrypted = this.encryptionService.encrypt(match.accessToken);
    const existing = await this.pageRepo.findOne({
      where: { businessId, fbPageId, deletedAt: IsNull() },
    });
    if (existing) {
      existing.pageName = match.name;
      existing.pictureUrl = match.pictureUrl;
      existing.accessTokenEncrypted = encrypted;
      existing.tokenExpiresAt = expiresAt;
      existing.scopes = FB_OAUTH_SCOPES;
      return this.pageRepo.save(existing);
    }
    return this.pageRepo.save(
      this.pageRepo.create({
        businessId,
        fbPageId,
        pageName: match.name,
        pictureUrl: match.pictureUrl,
        accessTokenEncrypted: encrypted,
        tokenExpiresAt: expiresAt,
        scopes: FB_OAUTH_SCOPES,
      }),
    );
  }

  async disconnectPage(businessId: string, pageId: string): Promise<void> {
    const page = await this.pageRepo.findOne({
      where: { id: pageId, businessId, deletedAt: IsNull() },
    });
    if (!page) {
      throw new NotFoundException({ message: 'Page not found', error: 'not_found' });
    }
    await this.pageRepo.softDelete(page.id);
  }

  async listConnectedPages(businessId: string): Promise<FacebookPage[]> {
    return this.pageRepo.find({
      where: { businessId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async decryptToken(pageId: string): Promise<string> {
    const page = await this.pageRepo.findOne({ where: { id: pageId, deletedAt: IsNull() } });
    if (!page) {
      throw new NotFoundException({ message: 'Page not found', error: 'not_found' });
    }
    return this.encryptionService.decrypt(page.accessTokenEncrypted);
  }

  private async getCachedUserToken(userId: string, businessId: string): Promise<string> {
    const token = await this.redis.get(this.fbTokenKey(userId, businessId));
    if (!token) {
      throw new BadRequestException({
        message: 'Facebook session expired, please reconnect',
        error: 'fb_session_expired',
      });
    }
    return token;
  }

  private fbTokenKey(userId: string, businessId: string): string {
    return `fb:user_token:${userId}:${businessId}`;
  }

  private async fetchUserPages(
    userAccessToken: string,
  ): Promise<Array<{ id: string; name: string; pictureUrl: string | null; accessToken: string }>> {
    const res = await this.graphGet('me/accounts', {
      access_token: userAccessToken,
      fields: 'id,name,picture{url},access_token',
    });
    const data = (res as { data?: Array<Record<string, unknown>> }).data ?? [];
    return data.map((p) => ({
      id: p.id as string,
      name: p.name as string,
      pictureUrl: ((p.picture as { data?: { url?: string } } | undefined)?.data?.url) ?? null,
      accessToken: p.access_token as string,
    }));
  }

  private signState(userId: string, businessId: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'STATE' })).toString('base64url');
    const payload: FbState = {
      userId,
      businessId,
      nonce: randomToken(8),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const data = `${header}.${body}`;
    const sig = this.hmac(data);
    return `${data}.${sig}`;
  }

  private verifyState(state: string): { userId: string; businessId: string } | null {
    const parts = state.split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    if (this.hmac(`${header}.${body}`) !== sig) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as FbState;
      if (!payload.userId || !payload.businessId) return null;
      if (payload.exp < Math.floor(Date.now() / 1000)) return null;
      return { userId: payload.userId, businessId: payload.businessId };
    } catch {
      return null;
    }
  }

  private hmac(data: string): string {
    return createHmac('sha256', this.stateSecret).update(data).digest('base64url');
  }

  async testPostToPage(
    fbPageUuid: string,
    caption: string,
    image: { buffer: Buffer; mime: string; originalName: string },
  ): Promise<{ fbPostId: string; viewUrl: string; pageName: string }> {
    if (!this.isConfigured()) {
      throw new BadRequestException({
        message: 'Facebook app credentials not configured',
        error: 'fb_not_configured',
      });
    }
    const page = await this.pageRepo.findOne({
      where: { id: fbPageUuid, deletedAt: IsNull() },
    });
    if (!page) {
      throw new NotFoundException({
        message: 'Facebook page not found',
        error: 'fb_page_not_found',
      });
    }
    const accessToken = this.encryptionService.decrypt(page.accessTokenEncrypted);

    const form = new FormData();
    form.append('caption', caption);
    form.append('access_token', accessToken);
    form.append('published', 'true');
    const blob = new Blob([new Uint8Array(image.buffer)], { type: image.mime });
    form.append('source', blob, image.originalName);

    const res = await fetch(
      `https://graph.facebook.com/${this.graphVersion}/${page.fbPageId}/photos`,
      { method: 'POST', body: form },
    );
    const data = (await res.json()) as {
      id?: string;
      error?: { message: string; type?: string; code: number };
    };
    if (!res.ok || !data.id) {
      this.logger.error(
        `testPostToPage failed: status=${res.status} body=${JSON.stringify(data).slice(0, 300)}`,
      );
      throw new BadRequestException({
        message: data.error?.message ?? `Facebook API returned ${res.status}`,
        error: 'fb_graph_error',
        fbCode: data.error?.code,
        fbType: data.error?.type,
      });
    }
    this.logger.log(
      `testPostToPage ok: page=${page.fbPageId} fbPostId=${data.id} captionLen=${caption.length}`,
    );
    return {
      fbPostId: data.id,
      viewUrl: `https://facebook.com/${data.id}`,
      pageName: page.pageName,
    };
  }

  private async graphGet(path: string, params: Record<string, string | number>): Promise<unknown> {
    const url = new URL(`https://graph.facebook.com/${this.graphVersion}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException({
        message: `Facebook Graph GET ${path} failed: ${res.status} ${text.slice(0, 200)}`,
        error: 'fb_graph_error',
      });
    }
    return res.json();
  }

  private async graphPost(path: string, body: Record<string, string>): Promise<unknown> {
    const url = `https://graph.facebook.com/${this.graphVersion}/${path}`;
    const params = new URLSearchParams(body);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException({
        message: `Facebook Graph POST ${path} failed: ${res.status} ${text.slice(0, 200)}`,
        error: 'fb_graph_error',
      });
    }
    return res.json();
  }
}
