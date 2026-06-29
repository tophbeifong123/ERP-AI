import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  // The host embedded in presigned URLs handed to external callers
  // (e.g. the n8n container uploading back to MinIO). Must be reachable
  // from those callers — in docker-compose that is `http://minio:9000`.
  presignEndpoint:
    process.env.S3_PRESIGN_ENDPOINT || process.env.S3_ENDPOINT || 'http://minio:9000',
  region: process.env.S3_REGION || 'us-east-1',
  accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
  bucket: process.env.S3_BUCKET || 'erp-ai',
  publicUrl: process.env.S3_PUBLIC_URL || 'http://localhost:9000/erp-ai',
}));
