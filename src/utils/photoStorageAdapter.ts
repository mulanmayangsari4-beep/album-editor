/**
 * 照片资产存储适配器 (Photo Storage Adapter Architecture)
 * 
 * 架构核心准则：
 * 1. “原图负责印刷质量，缩略图负责设计器速度，assetId 负责两者之间的身份关联。”
 * 2. 设计器 (Canvas/PhotoFrame/PhotoTray) 绝不直连特定云厂商 SDK，统一通过此 Adapter 解析 URL 与上传。
 * 3. 本地开发模式下使用 LocalPhotoStorageAdapter（基于内存 Blob / File / Data URL，100% 离线可用）；
 * 4. 未来接入 OSS / COS / S3 / GCS 时，仅需实现并注入 CloudPhotoStorageAdapter，无需侵入核心设计器。
 */

import { PhotoAsset, UploadStatus } from '../types/editor';

export interface StorageUploadResult {
  assetId: string;
  storageKey: string;
  originalUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
}

export interface PhotoStorageAdapter {
  /**
   * 适配器名称
   */
  readonly name: string;

  /**
   * 解析用于设计器快速预览的缩略图 URL
   */
  getThumbnailUrl(photo: PhotoAsset): string;

  /**
   * 解析用于画框排版的中等尺寸预览图 URL
   */
  getPreviewUrl(photo: PhotoAsset): string;

  /**
   * 解析用于印前导出/高精度渲染的高清原图 URL
   */
  getOriginalUrl(photo: PhotoAsset): string;

  /**
   * 异步上传原图至云端对象存储 (预留接口)
   * @param photo 本地照片资产
   * @param onProgress 进度回调 (0-100)
   */
  uploadOriginalAsync?(
    photo: PhotoAsset,
    onProgress?: (progress: number) => void
  ): Promise<StorageUploadResult>;
}

/**
 * 默认本地开发存储适配器 (100% 纯前端离线运行，零服务器依赖)
 */
export class LocalPhotoStorageAdapter implements PhotoStorageAdapter {
  readonly name = 'local-offline-storage';

  getThumbnailUrl(photo: PhotoAsset): string {
    return (
      photo.thumbnailUrl ||
      photo.thumbUrl ||
      photo.thumbnail?.url ||
      photo.previewUrl ||
      photo.url
    );
  }

  getPreviewUrl(photo: PhotoAsset): string {
    return (
      photo.previewUrl ||
      photo.preview?.url ||
      photo.thumbnailUrl ||
      photo.thumbUrl ||
      photo.url
    );
  }

  getOriginalUrl(photo: PhotoAsset): string {
    return (
      photo.originalUrl ||
      photo.original?.url ||
      photo.url ||
      photo.previewUrl ||
      photo.thumbUrl
    );
  }

  async uploadOriginalAsync(
    photo: PhotoAsset,
    onProgress?: (progress: number) => void
  ): Promise<StorageUploadResult> {
    // 模拟本地异步上传事件生命周期 (未来对接阿里云 OSS / 腾讯云 COS / AWS S3)
    if (onProgress) onProgress(100);
    return {
      assetId: photo.assetId || photo.id,
      storageKey: `photos/local/${photo.assetId || photo.id}.jpg`,
      originalUrl: this.getOriginalUrl(photo),
      thumbnailUrl: this.getThumbnailUrl(photo),
      previewUrl: this.getPreviewUrl(photo),
    };
  }
}

/**
 * 全局单例存储适配器实例 (默认为本地存储适配器)
 */
export const defaultStorageAdapter: PhotoStorageAdapter = new LocalPhotoStorageAdapter();
