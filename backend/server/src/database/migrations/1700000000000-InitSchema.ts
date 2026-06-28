import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email CITEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        email_verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        replaced_by_id UUID,
        user_agent TEXT,
        ip INET,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE email_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL CHECK (kind IN ('logo', 'service_image', 'post_media')),
        storage_key TEXT NOT NULL,
        mime TEXT NOT NULL,
        size_bytes BIGINT NOT NULL,
        public_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_files_owner_id ON files(owner_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_files_kind_created_at ON files(kind, created_at)`,
    );

    await queryRunner.query(`
      CREATE TABLE businesses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        industry TEXT NOT NULL,
        description TEXT,
        target_audience TEXT,
        tone TEXT,
        keywords TEXT[] NOT NULL DEFAULT '{}',
        auto_post_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        auto_post_mode TEXT CHECK (auto_post_mode IN ('ai_decide', 'fixed_schedule')),
        posts_per_week_target SMALLINT NOT NULL DEFAULT 3 CHECK (posts_per_week_target BETWEEN 1 AND 14),
        min_gap_days SMALLINT NOT NULL DEFAULT 1 CHECK (min_gap_days BETWEEN 0 AND 7),
        fixed_schedule_rules JSONB NOT NULL DEFAULT '[]',
        logo_file_id UUID REFERENCES files(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_businesses_owner_id ON businesses(owner_id) WHERE deleted_at IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        price_minor BIGINT NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'THB' CHECK (currency = 'THB'),
        image_file_id UUID REFERENCES files(id),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_services_business_id ON services(business_id) WHERE deleted_at IS NULL AND is_active = TRUE`,
    );

    await queryRunner.query(`
      CREATE TABLE facebook_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        fb_page_id TEXT NOT NULL,
        page_name TEXT NOT NULL,
        picture_url TEXT,
        access_token_encrypted BYTEA NOT NULL,
        token_expires_at TIMESTAMPTZ NOT NULL,
        scopes TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_facebook_pages_business_fb_page ON facebook_pages(business_id, fb_page_id) WHERE deleted_at IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_facebook_pages_token_expires_at ON facebook_pages(token_expires_at)`,
    );

    await queryRunner.query(`
      CREATE TABLE posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        fb_page_id UUID REFERENCES facebook_pages(id),
        caption TEXT,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'pending_approval', 'approved', 'posted', 'rejected', 'expired', 'failed')),
        post_type TEXT CHECK (post_type IN ('promotion', 'product_showcase', 'brand_awareness', 'event')),
        generation_source TEXT NOT NULL CHECK (generation_source IN ('auto_ai', 'fixed_schedule', 'manual')),
        scheduled_at TIMESTAMPTZ,
        approval_deadline TIMESTAMPTZ,
        posted_at TIMESTAMPTZ,
        fb_post_id TEXT,
        rejection_reason TEXT CHECK (rejection_reason IN ('user_rejected', 'timeout')),
        error_code TEXT,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_posts_business_status_created ON posts(business_id, status, created_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_posts_status_scheduled_approved ON posts(status, scheduled_at) WHERE status = 'approved'`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_posts_status_scheduled_pending ON posts(status, scheduled_at) WHERE status = 'pending_approval'`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_posts_business_posted ON posts(business_id, posted_at DESC) WHERE status = 'posted'`,
    );

    await queryRunner.query(`
      CREATE TABLE content_plans (
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

    await queryRunner.query(`
      CREATE TABLE post_media (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        file_id UUID NOT NULL REFERENCES files(id),
        kind TEXT NOT NULL CHECK (kind IN ('image', 'short_video')),
        order_index INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (post_id, order_index)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE post_featured_services (
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (post_id, service_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE ai_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES content_plans(id),
        type TEXT NOT NULL CHECK (type IN ('caption', 'image', 'short_video')),
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 3,
        last_error TEXT,
        payload JSONB NOT NULL DEFAULT '{}',
        result JSONB,
        next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_ai_jobs_status_next_run ON ai_jobs(status, next_run_at)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_ai_jobs_post_id ON ai_jobs(post_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        post_id UUID REFERENCES posts(id),
        type TEXT NOT NULL CHECK (type IN ('post_ready', 'post_posted', 'post_failed', 'post_expired')),
        channel TEXT NOT NULL DEFAULT 'email' CHECK (channel = 'email'),
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE email_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        template TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
        provider_message_id TEXT,
        error TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE unsubscribes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL CHECK (category IN ('marketing', 'transactional')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS unsubscribes CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS email_logs CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS notifications CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_jobs CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS post_featured_services CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS post_media CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS content_plans CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS posts CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS facebook_pages CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS services CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS businesses CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS files CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS password_resets CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS email_verifications CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_tokens CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS users CASCADE`);
  }
}
