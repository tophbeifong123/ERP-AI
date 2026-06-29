// src/core/services/post-service.ts
import apiClient from './api-client';
import { CreatedJobs, Post, PostMediaType, PostStatus, PostType } from '../types/post';

export interface GetPostsParams {
  businessId?: string;
  status?: PostStatus;
  postType?: string;
  from?: string;
  to?: string;
}

export interface CreatePostInput {
  businessId: string;
  hint: string;
  postType?: PostType;
  mediaType?: PostMediaType;
  featuredServiceIds?: string[];
}

export const postService = {
  /**
   * สร้างโพสต์ใหม่ (User-driven) — backend จะ enqueue AI pipeline:
   *   - caption + decision เสมอ
   *   - media (image หรือ short_video) 1 อย่าง ตาม mediaType ที่ user เลือก
   *     (เปิด/ปิดด้วย ENABLE_AI_MEDIA env ฝั่ง backend)
   * แล้วค่อยกลับมาเป็น pending_approval เมื่อทุก job เสร็จ
   */
  async createPost(data: CreatePostInput): Promise<{ post: Post; jobs: CreatedJobs }> {
    const response = await apiClient.post<{ post: Post; jobs: CreatedJobs }>(
      '/posts',
      data,
    );
    return response.data;
  },

  /**
   * ดึงรายการคิวโพสต์ตามตัวเลือก (GET /posts)
   */
  async getPosts(params?: GetPostsParams): Promise<Post[]> {
    const response = await apiClient.get<{ posts: Post[] }>('/posts', { params });
    return response.data.posts;
  },

  /**
   * ดึงรายละเอียดโพสต์เดี่ยว (GET /posts/:id)
   */
  async getPost(id: string): Promise<Post> {
    const response = await apiClient.get<{ post: Post }>(`/posts/${id}`);
    return response.data.post;
  },

  /**
   * แก้ไข caption / scheduledAt / postType / featuredServiceIds (PATCH /posts/:id)
   * — ไม่สามารถแก้ไข media ได้ (locked)
   */
  async updatePost(
    id: string,
    data: {
      caption?: string;
      scheduledAt?: string;
      postType?: PostType;
      featuredServiceIds?: string[];
    },
  ): Promise<Post> {
    const response = await apiClient.patch<{ post: Post }>(`/posts/${id}`, data);
    return response.data.post;
  },

  /**
   * อนุมัติโพสต์ (POST /posts/:id/approve) — รอจนถึง scheduledAt แล้ว cron จะยิงเอง
   */
  async approvePost(id: string): Promise<Post> {
    const response = await apiClient.post<{ post: Post }>(`/posts/${id}/approve`);
    return response.data.post;
  },

  /**
   * ปฏิเสธโพสต์ (POST /posts/:id/reject)
   */
  async rejectPost(id: string, reason?: string): Promise<Post> {
    const response = await apiClient.post<{ post: Post }>(`/posts/${id}/reject`, {
      reason,
    });
    return response.data.post;
  },

  /**
   * ลบโพสต์ออกจากคิว (DELETE /posts/:id)
   */
  async deletePost(id: string): Promise<void> {
    await apiClient.delete(`/posts/${id}`);
  },
};
