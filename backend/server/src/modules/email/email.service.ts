import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EmailJobData, EmailTemplate } from './email.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@InjectQueue('email') private emailQueue: Queue<EmailJobData>) {}

  async enqueue(data: EmailJobData): Promise<void> {
    await this.emailQueue.add(data.template, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    });
    this.logger.log(`Enqueued ${data.template} email to ${data.to}`);
  }

  enqueueVerifyEmail(userId: string, to: string, token: string): Promise<void> {
    return this.enqueue({
      template: 'verify-email',
      userId,
      to,
      payload: { token },
    });
  }

  enqueueResetPassword(
    userId: string,
    to: string,
    token: string,
  ): Promise<void> {
    return this.enqueue({
      template: 'reset-password',
      userId,
      to,
      payload: { token },
    });
  }

  enqueuePostReady(
    userId: string,
    to: string,
    payload: {
      businessName: string;
      postId: string;
      caption: string;
      postType?: string | null;
      approvalDeadline?: string | null;
    },
  ): Promise<void> {
    return this.enqueue({ template: 'post-ready', userId, to, payload });
  }

  enqueuePostExpired(
    userId: string,
    to: string,
    payload: {
      businessName: string;
      postId: string;
      caption: string;
      reason: 'user_rejected' | 'timeout';
    },
  ): Promise<void> {
    return this.enqueue({ template: 'post-expired', userId, to, payload });
  }

  enqueuePostPosted(
    userId: string,
    to: string,
    payload: {
      businessName: string;
      postId: string;
      caption: string;
      fbPostId: string;
      pageName: string;
      viewUrl?: string;
    },
  ): Promise<void> {
    return this.enqueue({ template: 'post-posted', userId, to, payload });
  }

  enqueuePostFailed(
    userId: string,
    to: string,
    payload: {
      businessName: string;
      postId: string;
      caption: string;
      errorCode: string;
      errorMessage: string;
    },
  ): Promise<void> {
    return this.enqueue({ template: 'post-failed', userId, to, payload });
  }
}
