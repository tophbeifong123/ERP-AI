import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL || '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL || '604800', 10),
  },
  internalApiKey: process.env.INTERNAL_API_KEY || 'dev-internal-api-key',
  fbTokenEncryptionKey: process.env.FB_TOKEN_ENCRYPTION_KEY || '',
  facebook: {
    appId: process.env.FB_APP_ID || '',
    appSecret: process.env.FB_APP_SECRET || '',
    redirectUri: process.env.FB_REDIRECT_URI || 'http://localhost:3000/facebook/oauth/callback',
    graphVersion: process.env.FB_GRAPH_VERSION || 'v19.0',
  },
  ai: {
    decisionUrl: process.env.AI_DECISION_URL || 'http://localhost:4001',
    captionUrl: process.env.AI_CAPTION_URL || 'http://localhost:4002',
    mediaUrl: process.env.AI_MEDIA_URL || 'http://localhost:4003',
  },
}));
