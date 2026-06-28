import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createTransport, Transporter } from 'nodemailer';
import { EmailLog } from '../../database/entities/email-log.entity';
import { EmailJobData } from './email.types';
import {
  renderPostExpired,
  renderPostFailed,
  renderPostPosted,
  renderPostReady,
  renderResetPassword,
  renderVerifyEmail,
} from './templates/email.templates';

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: Transporter;

  constructor(
    private configService: ConfigService,
    @InjectRepository(EmailLog)
    private emailLogRepo: Repository<EmailLog>,
  ) {
    super();
    this.transporter = createTransport({
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: false,
      ignoreTLS: true,
      auth:
        this.configService.get<string>('mail.user') && this.configService.get<string>('mail.pass')
          ? {
              user: this.configService.get<string>('mail.user'),
              pass: this.configService.get<string>('mail.pass'),
            }
          : undefined,
    });
  }

  async process(job: Job<EmailJobData>): Promise<{ messageId: string }> {
    const { template, userId, to, payload } = job.data;
    const appUrl = this.configService.get<string>('app.appUrl') || 'http://localhost:3000';
    const frontendUrl = this.configService.get<string>('app.frontendUrl') || 'http://localhost:3001';
    const from = this.configService.get<string>('mail.from');

    let rendered: { subject: string; html: string; text: string };
    if (template === 'verify-email') {
      const token = payload.token as string;
      rendered = renderVerifyEmail(`${appUrl}/auth/verify-email?token=${token}`);
    } else if (template === 'reset-password') {
      const token = payload.token as string;
      rendered = renderResetPassword(`${appUrl}/auth/reset-password?token=${token}`);
    } else if (template === 'post-ready') {
      rendered = renderPostReady({
        businessName: payload.businessName as string,
        postId: payload.postId as string,
        caption: (payload.caption as string) ?? '',
        postType: (payload.postType as string | null) ?? null,
        reviewUrl: `${frontendUrl}/posts/${payload.postId}`,
        approvalDeadline: (payload.approvalDeadline as string | null) ?? null,
      });
    } else if (template === 'post-expired') {
      rendered = renderPostExpired({
        businessName: payload.businessName as string,
        postId: payload.postId as string,
        caption: (payload.caption as string) ?? '',
        reason: (payload.reason as 'user_rejected' | 'timeout') ?? 'user_rejected',
        reviewUrl: `${frontendUrl}/posts/${payload.postId}`,
      });
    } else if (template === 'post-posted') {
      rendered = renderPostPosted({
        businessName: payload.businessName as string,
        postId: payload.postId as string,
        caption: (payload.caption as string) ?? '',
        fbPostId: payload.fbPostId as string,
        pageName: payload.pageName as string,
        viewUrl:
          (payload.viewUrl as string) ??
          `https://facebook.com/${payload.fbPostId as string}`,
      });
    } else if (template === 'post-failed') {
      rendered = renderPostFailed({
        businessName: payload.businessName as string,
        postId: payload.postId as string,
        caption: (payload.caption as string) ?? '',
        errorCode: payload.errorCode as string,
        errorMessage: payload.errorMessage as string,
        reviewUrl: `${frontendUrl}/posts/${payload.postId}`,
      });
    } else {
      throw new Error(`Unknown template: ${template}`);
    }

    const log = await this.emailLogRepo.save(
      this.emailLogRepo.create({ userId, template, payload, status: 'queued' }),
    );

    try {
      const info = await this.transporter.sendMail({
        from,
        to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      await this.emailLogRepo.update(log.id, {
        status: 'sent',
        sentAt: new Date(),
        providerMessageId: info.messageId ?? null,
        error: null,
      });
      this.logger.log(`Sent ${template} to ${to} (messageId=${info.messageId ?? 'n/a'})`);
      return { messageId: info.messageId ?? '' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.emailLogRepo.update(log.id, { status: 'failed', error: message });
      this.logger.error(`Failed to send ${template} to ${to}: ${message}`);
      throw err;
    }
  }
}
