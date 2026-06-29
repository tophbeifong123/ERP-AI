// src/core/services/file-service.ts
import apiClient from './api-client';

export type FileKind = 'logo' | 'service_image' | 'post_media';

export interface UploadedFile {
  id: string;
  kind: FileKind;
  storageKey: string;
  mime: string;
  sizeBytes: number;
  publicUrl: string;
  createdAt: string;
}

export const fileService = {
  /**
   * อัปโหลดไฟล์ (รูปภาพ/วิดีโอ) ขึ้น MinIO ผ่าน Backend
   */
  async uploadFile(file: File, kind: FileKind): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<{ file: UploadedFile }>(
      `/files/upload/${kind}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data.file;
  },
};
