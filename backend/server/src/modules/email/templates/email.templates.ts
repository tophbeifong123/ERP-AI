const escape = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const renderVerifyEmail = (link: string): { subject: string; html: string; text: string } => ({
  subject: 'Verify your ERP-AI email',
  html: `<!doctype html>
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:560px;margin:auto;padding:24px">
<h2>Welcome to ERP-AI</h2>
<p>Please confirm your email by clicking the link below.</p>
<p><a href="${escape(link)}" style="display:inline-block;background:#1a73e8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Verify email</a></p>
<p>Or copy and paste this URL into your browser:</p>
<p><code>${escape(link)}</code></p>
<p>This link expires in 24 hours.</p>
</body></html>`,
  text: `Welcome to ERP-AI\n\nVerify your email: ${link}\n\nThis link expires in 24 hours.`,
});

export const renderResetPassword = (link: string): { subject: string; html: string; text: string } => ({
  subject: 'Reset your ERP-AI password',
  html: `<!doctype html>
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:560px;margin:auto;padding:24px">
<h2>Password reset</h2>
<p>We received a request to reset your password. Click the link below to choose a new one.</p>
<p><a href="${escape(link)}" style="display:inline-block;background:#1a73e8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Reset password</a></p>
<p>Or copy and paste this URL into your browser:</p>
<p><code>${escape(link)}</code></p>
<p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
</body></html>`,
  text: `Reset your ERP-AI password: ${link}\n\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
});

export interface PostReadyContext {
  businessName: string;
  postId: string;
  caption: string;
  postType?: string | null;
  reviewUrl: string;
  approvalDeadline?: Date | string | null;
}

export const renderPostReady = (ctx: PostReadyContext): { subject: string; html: string; text: string } => {
  const subject = `New post ready for review — ${ctx.businessName}`;
  const deadline = ctx.approvalDeadline
    ? `<p>Auto-rejection deadline: <strong>${escape(new Date(ctx.approvalDeadline).toISOString())}</strong></p>`
    : '';
  return {
    subject,
    html: `<!doctype html>
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:560px;margin:auto;padding:24px">
<h2>Your post is ready for review</h2>
<p>Business: <strong>${escape(ctx.businessName)}</strong>${ctx.postType ? ` (${escape(ctx.postType)})` : ''}</p>
<p style="background:#f6f8fa;padding:12px 16px;border-radius:6px;white-space:pre-wrap">${escape(ctx.caption)}</p>
${deadline}
<p><a href="${escape(ctx.reviewUrl)}" style="display:inline-block;background:#1a73e8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Review & approve</a></p>
<p style="color:#666;font-size:12px">Post ID: ${escape(ctx.postId)}</p>
</body></html>`,
    text: `Your post is ready for review\n\nBusiness: ${ctx.businessName}${ctx.postType ? ` (${ctx.postType})` : ''}\n\n${ctx.caption}\n\n${ctx.approvalDeadline ? `Auto-rejection deadline: ${new Date(ctx.approvalDeadline).toISOString()}\n\n` : ''}Review: ${ctx.reviewUrl}\n\nPost ID: ${ctx.postId}`,
  };
};

export interface PostExpiredContext {
  businessName: string;
  postId: string;
  caption: string;
  reason: 'user_rejected' | 'timeout';
  reviewUrl: string;
}

export const renderPostExpired = (ctx: PostExpiredContext): { subject: string; html: string; text: string } => {
  const subject = `Post expired — ${ctx.businessName}`;
  const reasonText = ctx.reason === 'timeout' ? 'auto-rejected (approval timeout)' : 'rejected';
  return {
    subject,
    html: `<!doctype html>
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:560px;margin:auto;padding:24px">
<h2>Post ${escape(reasonText)}</h2>
<p>Business: <strong>${escape(ctx.businessName)}</strong></p>
<p style="background:#f6f8fa;padding:12px 16px;border-radius:6px;white-space:pre-wrap">${escape(ctx.caption)}</p>
<p>Post ID: ${escape(ctx.postId)}</p>
<p><a href="${escape(ctx.reviewUrl)}" style="display:inline-block;background:#1a73e8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">View post</a></p>
</body></html>`,
    text: `Post ${reasonText}\n\nBusiness: ${ctx.businessName}\n\n${ctx.caption}\n\nPost ID: ${ctx.postId}\nView: ${ctx.reviewUrl}`,
  };
};

export interface PostPostedContext {
  businessName: string;
  postId: string;
  caption: string;
  fbPostId: string;
  pageName: string;
  viewUrl: string;
}

export const renderPostPosted = (ctx: PostPostedContext): { subject: string; html: string; text: string } => {
  const subject = `Post published to ${ctx.pageName}`;
  return {
    subject,
    html: `<!doctype html>
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:560px;margin:auto;padding:24px">
<h2>Your post is live 🎉</h2>
<p>Business: <strong>${escape(ctx.businessName)}</strong></p>
<p>Published to page: <strong>${escape(ctx.pageName)}</strong></p>
<p style="background:#f6f8fa;padding:12px 16px;border-radius:6px;white-space:pre-wrap">${escape(ctx.caption)}</p>
<p><a href="${escape(ctx.viewUrl)}" style="display:inline-block;background:#1a73e8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">View on Facebook</a></p>
<p style="color:#666;font-size:12px">Internal Post ID: ${escape(ctx.postId)} · FB Post ID: ${escape(ctx.fbPostId)}</p>
</body></html>`,
    text: `Your post is live!\n\nBusiness: ${ctx.businessName}\nPublished to: ${ctx.pageName}\n\n${ctx.caption}\n\nView: ${ctx.viewUrl}\n\nInternal Post ID: ${ctx.postId} · FB Post ID: ${ctx.fbPostId}`,
  };
};

export interface PostFailedContext {
  businessName: string;
  postId: string;
  caption: string;
  errorCode: string;
  errorMessage: string;
  reviewUrl: string;
}

export const renderPostFailed = (ctx: PostFailedContext): { subject: string; html: string; text: string } => {
  const subject = `Post failed — ${ctx.businessName}`;
  return {
    subject,
    html: `<!doctype html>
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:560px;margin:auto;padding:24px">
<h2>Post could not be published</h2>
<p>Business: <strong>${escape(ctx.businessName)}</strong></p>
<p style="background:#f6f8fa;padding:12px 16px;border-radius:6px;white-space:pre-wrap">${escape(ctx.caption)}</p>
<p><strong>Error:</strong> <code>${escape(ctx.errorCode)}</code> — ${escape(ctx.errorMessage)}</p>
<p>Post ID: ${escape(ctx.postId)}</p>
<p><a href="${escape(ctx.reviewUrl)}" style="display:inline-block;background:#d93025;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">View post</a></p>
</body></html>`,
    text: `Post could not be published\n\nBusiness: ${ctx.businessName}\n\n${ctx.caption}\n\nError: ${ctx.errorCode} — ${ctx.errorMessage}\n\nPost ID: ${ctx.postId}\nView: ${ctx.reviewUrl}`,
  };
};
