import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyPostsAndDropAutoPost1700000000001
  implements MigrationInterface
{
  name = 'SimplifyPostsAndDropAutoPost1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Drop business auto-post columns
    await queryRunner.query(
      `ALTER TABLE businesses DROP COLUMN IF EXISTS auto_post_enabled`,
    );
    await queryRunner.query(
      `ALTER TABLE businesses DROP COLUMN IF EXISTS auto_post_mode`,
    );
    await queryRunner.query(
      `ALTER TABLE businesses DROP COLUMN IF EXISTS posts_per_week_target`,
    );
    await queryRunner.query(
      `ALTER TABLE businesses DROP COLUMN IF EXISTS min_gap_days`,
    );
    await queryRunner.query(
      `ALTER TABLE businesses DROP COLUMN IF EXISTS fixed_schedule_rules`,
    );

    // 2) Drop content_plans table (CASCADE removes FKs from ai_jobs)
    await queryRunner.query(`DROP TABLE IF EXISTS content_plans CASCADE`);

    // 3) Drop plan_id from ai_jobs
    await queryRunner.query(
      `ALTER TABLE ai_jobs DROP COLUMN IF EXISTS plan_id`,
    );

    // 4) Expand ai_jobs.type check to include 'decision'
    await queryRunner.query(`ALTER TABLE ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_type_check`);
    await queryRunner.query(
      `ALTER TABLE ai_jobs ADD CONSTRAINT ai_jobs_type_check CHECK (type IN ('caption', 'image', 'short_video', 'decision'))`,
    );

    // 5) Add suggested_scheduled_at to posts
    await queryRunner.query(
      `ALTER TABLE posts ADD COLUMN IF NOT EXISTS suggested_scheduled_at TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_posts_suggested_scheduled_at ON posts(suggested_scheduled_at) WHERE suggested_scheduled_at IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse operations (for rollback only)
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_posts_suggested_scheduled_at`,
    );
    await queryRunner.query(
      `ALTER TABLE posts DROP COLUMN IF EXISTS suggested_scheduled_at`,
    );

    await queryRunner.query(`ALTER TABLE ai_jobs DROP CONSTRAINT IF EXISTS ai_jobs_type_check`);
    await queryRunner.query(
      `ALTER TABLE ai_jobs ADD CONSTRAINT ai_jobs_type_check CHECK (type IN ('caption', 'image', 'short_video'))`,
    );

    await queryRunner.query(
      `ALTER TABLE ai_jobs ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES content_plans(id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS content_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        decided_by TEXT NOT NULL CHECK (decided_by IN ('ai', 'user')),
        should_post_today BOOLEAN NOT NULL DEFAULT TRUE,
        status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'materialized', 'cancelled')),
        ai_reasoning TEXT,
        suggested_post_type TEXT,
        suggested_featured_service_ids UUID[] NOT NULL DEFAULT '{}',
        suggested_caption_hint TEXT,
        suggested_scheduled_at TIMESTAMPTZ,
        target_window_start TIMESTAMPTZ,
        target_window_end TIMESTAMPTZ,
        payload_json JSONB NOT NULL DEFAULT '{}',
        materialized_post_id UUID REFERENCES posts(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_post_enabled BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    await queryRunner.query(
      `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_post_mode TEXT CHECK (auto_post_mode IN ('ai_decide', 'fixed_schedule'))`,
    );
    await queryRunner.query(
      `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS posts_per_week_target SMALLINT NOT NULL DEFAULT 3 CHECK (posts_per_week_target BETWEEN 1 AND 14)`,
    );
    await queryRunner.query(
      `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS min_gap_days SMALLINT NOT NULL DEFAULT 1 CHECK (min_gap_days BETWEEN 0 AND 7)`,
    );
    await queryRunner.query(
      `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS fixed_schedule_rules JSONB NOT NULL DEFAULT '[]'`,
    );
  }
}
