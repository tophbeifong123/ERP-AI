import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostMediaType1719700000000 implements MigrationInterface {
  name = 'AddPostMediaType1719700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE posts
      ADD COLUMN media_type text NOT NULL DEFAULT 'image'`);
    await q.query(`CREATE INDEX idx_posts_media_type
      ON posts (business_id, media_type)
      WHERE deleted_at IS NULL`);
    await q.query(`UPDATE posts p
      SET media_type = 'short_video'
      FROM post_media m
      WHERE m.post_id = p.id
        AND m.kind = 'short_video'
        AND p.media_type = 'image'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS idx_posts_media_type`);
    await q.query(`ALTER TABLE posts DROP COLUMN media_type`);
  }
}
