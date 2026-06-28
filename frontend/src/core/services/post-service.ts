// src/core/services/post-service.ts
import apiClient from './api-client';
import { Post, PostStatus } from '../types/post';

export interface GetPostsParams {
  businessId?: string;
  status?: PostStatus;
  postType?: string;
  from?: string;
  to?: string;
}

export const postService = {
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
   * อนุมัติโพสต์ (POST /posts/:id/approve)
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
