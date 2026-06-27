import { BadRequestException } from '@nestjs/common';
import { PostStatus } from '../../database/entities/post.entity';

const ALLOWED: Record<PostStatus, PostStatus[]> = {
  draft: ['generating', 'pending_approval', 'expired'],
  generating: ['pending_approval', 'failed', 'expired'],
  pending_approval: ['approved', 'rejected', 'expired', 'generating'],
  approved: ['posted', 'expired', 'failed', 'generating'],
  posted: [],
  rejected: ['generating', 'expired'],
  expired: [],
  failed: ['generating', 'expired'],
};

export class PostStateMachine {
  static assertTransition(from: PostStatus, to: PostStatus): void {
    if (from === to) return;
    const allowed = ALLOWED[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        message: `Invalid transition: ${from} -> ${to}`,
        error: 'invalid_state_transition',
        from,
        to,
        allowed,
      });
    }
  }

  static canTransition(from: PostStatus, to: PostStatus): boolean {
    if (from === to) return true;
    return (ALLOWED[from] ?? []).includes(to);
  }
}
