export type EmailTemplate =
  | 'verify-email'
  | 'reset-password'
  | 'post-ready'
  | 'post-expired'
  | 'post-posted'
  | 'post-failed';

export interface EmailJobData {
  template: EmailTemplate;
  userId: string;
  to: string;
  payload: Record<string, unknown>;
}
