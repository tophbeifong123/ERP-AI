import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as entities from './entities';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USER || 'erp',
  password: process.env.DATABASE_PASSWORD || 'erp',
  database: process.env.DATABASE_NAME || 'erp_ai',
  entities: Object.values(entities),
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
