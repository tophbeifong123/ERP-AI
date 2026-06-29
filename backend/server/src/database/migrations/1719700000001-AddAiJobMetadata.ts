import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiJobMetadata1719700000001 implements MigrationInterface {
  name = 'AddAiJobMetadata1719700000001';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE ai_jobs
      ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await q.query(`ALTER TABLE ai_jobs
      ADD COLUMN error_code text NULL`);
    await q.query(`CREATE INDEX idx_ai_jobs_error_code
      ON ai_jobs (error_code)
      WHERE error_code IS NOT NULL`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_ai_jobs_error_code`);
    await q.query(`ALTER TABLE ai_jobs DROP COLUMN error_code`);
    await q.query(`ALTER TABLE ai_jobs DROP COLUMN metadata`);
  }
}
