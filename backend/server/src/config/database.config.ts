import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  user: process.env.DATABASE_USER || 'erp',
  password: process.env.DATABASE_PASSWORD || 'erp',
  name: process.env.DATABASE_NAME || 'erp_ai',
}));
