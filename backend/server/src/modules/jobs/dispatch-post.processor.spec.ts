import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DispatchPostProcessor } from './dispatch-post.processor';
import { Post } from '../../database/entities/post.entity';
import { PostMedia } from '../../database/entities/post-media.entity';
import { File } from '../../database/entities/file.entity';
import { FacebookPage } from '../../database/entities/facebook-page.entity';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PostEventsService } from '../posts/post-events.service';

describe('DispatchPostProcessor (Phase 4)', () => {
  let processor: DispatchPostProcessor;
  let postRepo: Repository<Post>;
  let pageRepo: Repository<FacebookPage>;
  let fileRepo: Repository<File>;
  let postMediaRepo: Repository<PostMedia>;
  let encryption: EncryptionService;
  const savedPosts: Post[] = [];
  const originalFetch = global.fetch;
  const mockedCalls: any[] = [];

  beforeEach(async () => {
    savedPosts.length = 0;
    mockedCalls.length = 0;
    global.fetch = jest.fn(async (url: any, opts: any) => {
      const u = new URL(url);
      mockedCalls.push({ url: u.pathname, body: JSON.parse(opts.body || '{}') });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'mock-fb-123' }),
      } as any;
    }) as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchPostProcessor,
        { provide: ConfigService, useValue: { get: (k: string) => k === 'app.facebook.graphVersion' ? 'vTest.0' : null } },
        {
          provide: getRepositoryToken(Post),
          useValue: {
            findOne: async (opts: any) => {
              const id = opts.where.id;
              return savedPosts.find(p => p.id === id) || null;
            },
            save: async (p: Post) => { const idx = savedPosts.findIndex(x => x.id === p.id); if (idx >= 0) savedPosts[idx] = p; else savedPosts.push(p); return p; },
          },
        },
        {
          provide: getRepositoryToken(PostMedia),
          useValue: {
            // not used in our code path - we sort manually
          },
        },
        {
          provide: getRepositoryToken(File),
          useValue: {
            findOne: async (opts: any) => {
              if (opts.where.id === 'file-img') return { id: 'file-img', publicUrl: 'http://minio/img.png', mime: 'image/png' } as any;
              if (opts.where.id === 'file-vid') return { id: 'file-vid', publicUrl: 'http://minio/vid.mp4', mime: 'video/mp4' } as any;
              return null;
            },
          },
        },
        {
          provide: getRepositoryToken(FacebookPage),
          useValue: {
            findOne: async () => ({
              id: 'fb-page-1',
              fbPageId: 'mock-page-1',
              accessTokenEncrypted: 'enc:token',
            } as any),
          },
        },
        {
          provide: EncryptionService,
          useValue: { decrypt: (s: string) => s.replace(/^enc:/, '') },
        },
        {
          provide: PostEventsService,
          useValue: { emitForStatus: async () => {} },
        },
      ],
    }).compile();

    processor = module.get<DispatchPostProcessor>(DispatchPostProcessor);
    postRepo = module.get(getRepositoryToken(Post));
    pageRepo = module.get(getRepositoryToken(FacebookPage));
    fileRepo = module.get(getRepositoryToken(File));
    postMediaRepo = module.get(getRepositoryToken(PostMedia));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const makePost = (overrides: Partial<Post> = {}): Post => ({
    id: 'post-1',
    businessId: 'biz-1',
    fbPageId: 'fb-page-1',
    caption: 'Hello',
    status: 'approved',
    postType: 'promotion',
    generationSource: 'manual',
    scheduledAt: new Date(Date.now() - 60_000),
    approvalDeadline: null,
    postedAt: null,
    fbPostId: null,
    rejectionReason: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    media: [],
    aiJobs: [],
    business: undefined as any,
    fbPage: undefined as any,
    ...overrides,
  } as any);

  it('dispatches a post with an image to /photos endpoint', async () => {
    const post = makePost({
      id: 'p-img',
      media: [
        { id: 'pm-1', postId: 'p-img', fileId: 'file-img', kind: 'image', orderIndex: 0, createdAt: new Date() } as any,
      ],
    });
    savedPosts.push(post);
    const result = await processor.process({ data: { postId: 'p-img' } } as any);
    expect(result.fbPostId).toBe('mock-fb-123');
    expect(result.endpoint).toBe('https://graph.facebook.com/vTest.0/mock-page-1/photos');
    expect(mockedCalls).toHaveLength(1);
    expect(mockedCalls[0].url).toBe('/vTest.0/mock-page-1/photos');
    expect(mockedCalls[0].body.caption).toBe('Hello');
    expect(mockedCalls[0].body.url).toBe('http://minio/img.png');
    expect(mockedCalls[0].body.published).toBe(true);
    expect(savedPosts[0].status).toBe('posted');
    expect(savedPosts[0].fbPostId).toBe('mock-fb-123');
  });

  it('dispatches a post with a short_video to /videos endpoint', async () => {
    const post = makePost({
      id: 'p-vid',
      media: [
        { id: 'pm-2', postId: 'p-vid', fileId: 'file-vid', kind: 'short_video', orderIndex: 0, createdAt: new Date() } as any,
      ],
    });
    savedPosts.push(post);
    const result = await processor.process({ data: { postId: 'p-vid' } } as any);
    expect(result.fbPostId).toBe('mock-fb-123');
    expect(result.endpoint).toBe('https://graph.facebook.com/vTest.0/mock-page-1/videos');
    expect(mockedCalls).toHaveLength(1);
    expect(mockedCalls[0].url).toBe('/vTest.0/mock-page-1/videos');
    expect(mockedCalls[0].body.description).toBe('Hello');
    expect(mockedCalls[0].body.file_url).toBe('http://minio/vid.mp4');
  });

  it('falls back to /feed when there is no media', async () => {
    const post = makePost({ id: 'p-nomedia', media: [] });
    savedPosts.push(post);
    const result = await processor.process({ data: { postId: 'p-nomedia' } } as any);
    expect(result.endpoint).toBe('https://graph.facebook.com/vTest.0/mock-page-1/feed');
    expect(mockedCalls[0].body.message).toBe('Hello');
    expect(mockedCalls[0].body.url).toBeUndefined();
  });

  it('marks post failed and rethrows when Facebook errors', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid OAuth', code: 190 } }),
    })) as any;

    const post = makePost({ id: 'p-err', media: [] });
    savedPosts.push(post);
    await expect(processor.process({ data: { postId: 'p-err' } } as any)).rejects.toThrow(/Invalid OAuth/);
    expect(savedPosts[0].status).toBe('failed');
    expect(savedPosts[0].errorCode).toBe('E190');
  });

  it('skips post that is not in approved status', async () => {
    const post = makePost({ id: 'p-skip', status: 'draft' });
    savedPosts.push(post);
    const result = await processor.process({ data: { postId: 'p-skip' } } as any);
    expect(result.fbPostId).toBe('');
    expect(result.endpoint).toBe('skipped');
    expect(mockedCalls).toHaveLength(0);
  });

  it('marks post as failed when access token cannot be decrypted', async () => {
    // Swap the encryption stub to throw
    const enc = (processor as any).encryption;
    enc.decrypt = () => { throw new Error('Encrypted payload too short'); };

    const post = makePost({ id: 'p-bad-token' });
    savedPosts.push(post);
    await expect(processor.process({ data: { postId: 'p-bad-token' } } as any)).rejects.toThrow(/Failed to decrypt/);
    expect(savedPosts[0].status).toBe('failed');
    expect(savedPosts[0].errorCode).toBe('E_TOKEN_DECRYPT');
    expect(savedPosts[0].errorMessage).toContain('Encrypted payload too short');
  });
});
