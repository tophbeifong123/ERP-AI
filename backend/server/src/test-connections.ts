import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import * as nodemailer from 'nodemailer';
import { config } from 'dotenv';

config();

async function testPostgres() {
  console.log('\n🐘 Testing PostgreSQL connection...');
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'erp',
    password: process.env.DATABASE_PASSWORD || 'erp',
    database: process.env.DATABASE_NAME || 'erp_ai',
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    const result = await dataSource.query('SELECT 1 as test');
    console.log('✅ PostgreSQL connected:', result);
    await dataSource.destroy();
    return true;
  } catch (err) {
    console.error('❌ PostgreSQL failed:', err.message);
    return false;
  }
}

async function testRedis() {
  console.log('\n🔴 Testing Redis connection...');
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const result = await redis.ping();
    console.log('✅ Redis connected:', result);
    await redis.quit();
    return true;
  } catch (err) {
    console.error('❌ Redis failed:', err.message);
    return false;
  }
}

async function testMinIO() {
  console.log('\n📦 Testing MinIO/S3 connection...');
  const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    },
    forcePathStyle: true,
  });

  const bucket = process.env.S3_BUCKET || 'erp-ai';

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✅ MinIO connected, bucket "${bucket}" exists`);
    return true;
  } catch (err) {
    if (err.name === 'NotFound') {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`✅ MinIO connected, created bucket "${bucket}"`);
        return true;
      } catch (createErr) {
        console.error('❌ MinIO failed to create bucket:', createErr.message);
        return false;
      }
    }
    console.error('❌ MinIO failed:', err.message);
    return false;
  }
}

async function testMailhog() {
  console.log('\n📧 Testing Mailhog/SMTP connection...');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    secure: false,
  });

  try {
    await transporter.verify();
    console.log('✅ SMTP connected');
    return true;
  } catch (err) {
    console.error('❌ SMTP failed:', err.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing all service connections...\n');
  console.log('Environment:');
  console.log(`  DATABASE_HOST: ${process.env.DATABASE_HOST || 'localhost'}`);
  console.log(`  REDIS_HOST: ${process.env.REDIS_HOST || 'localhost'}`);
  console.log(
    `  S3_ENDPOINT: ${process.env.S3_ENDPOINT || 'http://localhost:9000'}`,
  );
  console.log(`  SMTP_HOST: ${process.env.SMTP_HOST || 'localhost'}`);

  const results = {
    postgres: await testPostgres(),
    redis: await testRedis(),
    minio: await testMinIO(),
    mailhog: await testMailhog(),
  };

  console.log('\n📊 Summary:');
  console.log(`  PostgreSQL: ${results.postgres ? '✅' : '❌'}`);
  console.log(`  Redis: ${results.redis ? '✅' : '❌'}`);
  console.log(`  MinIO: ${results.minio ? '✅' : '❌'}`);
  console.log(`  Mailhog: ${results.mailhog ? '✅' : '❌'}`);

  const allPassed = Object.values(results).every((r) => r);
  console.log(
    `\n${allPassed ? '✅ All connections successful!' : '❌ Some connections failed'}`,
  );

  process.exit(allPassed ? 0 : 1);
}

main();
