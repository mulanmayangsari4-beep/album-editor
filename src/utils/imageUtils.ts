import { UploadedPhoto } from '../types/editor';

/**
 * 将用户上传的本地 File 对象读取并生成 UploadedPhoto 对象 (全本地处理，不上传服务器)
 */
export async function processLocalImageFile(file: File): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const originalUrl = e.target?.result as string;
      const img = new Image();

      img.onload = () => {
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        let aspectRatio: 'horizontal' | 'vertical' | 'square' = 'square';
        const ratio = naturalWidth / naturalHeight;
        if (ratio > 1.15) {
          aspectRatio = 'horizontal';
        } else if (ratio < 0.85) {
          aspectRatio = 'vertical';
        }

        // 制作轻量化缩略图（最大边 400px），用于托盘流畅渲染
        const canvas = document.createElement('canvas');
        const maxThumbSize = 400;
        let thumbW = naturalWidth;
        let thumbH = naturalHeight;

        if (naturalWidth > naturalHeight) {
          if (naturalWidth > maxThumbSize) {
            thumbW = maxThumbSize;
            thumbH = Math.round((naturalHeight * maxThumbSize) / naturalWidth);
          }
        } else {
          if (naturalHeight > maxThumbSize) {
            thumbH = maxThumbSize;
            thumbW = Math.round((naturalWidth * maxThumbSize) / naturalHeight);
          }
        }

        canvas.width = thumbW;
        canvas.height = thumbH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, thumbW, thumbH);
          const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);

          const photo: UploadedPhoto = {
            id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            name: file.name,
            url: originalUrl,
            thumbUrl: thumbUrl,
            naturalWidth,
            naturalHeight,
            fileSize: file.size,
            usedCount: 0,
            aspectRatio,
            createdAt: Date.now(),
          };

          resolve(photo);
        } else {
          // fallback
          resolve({
            id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            name: file.name,
            url: originalUrl,
            thumbUrl: originalUrl,
            naturalWidth,
            naturalHeight,
            fileSize: file.size,
            usedCount: 0,
            aspectRatio,
            createdAt: Date.now(),
          });
        }
      };

      img.onerror = () => {
        reject(new Error('无法解析图片文件，请确保格式正确'));
      };

      img.src = originalUrl;
    };

    reader.onerror = () => {
      reject(new Error('读取本地文件失败'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 格式化文件大小为易读字符串 (KB, MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 计算插槽中照片的预估印刷 DPI
 * @param slotWidthMm 照片框在实际开本中的物理宽度 (mm)
 * @param naturalWidth 照片本身像素宽
 * @param zoom 当前用户设置的裁剪放大倍率 (1.0 - 3.0)
 */
export function calculatePrintDpi(slotWidthMm: number, naturalWidth: number, zoom = 1): {
  dpi: number;
  status: 'optimal' | 'good' | 'low';
} {
  // 1 英寸 = 25.4 毫米
  const slotWidthInches = slotWidthMm / 25.4;
  if (slotWidthInches <= 0) return { dpi: 300, status: 'optimal' };

  // 放大后实际利用的有效像素宽 = naturalWidth / zoom
  const effectivePixels = naturalWidth / (zoom || 1);
  const dpi = Math.round(effectivePixels / slotWidthInches);

  if (dpi >= 300) {
    return { dpi, status: 'optimal' }; // 极佳 (>=300 DPI)
  } else if (dpi >= 150) {
    return { dpi, status: 'good' }; // 良好 (150-299 DPI)
  } else {
    return { dpi, status: 'low' }; // 偏低警告 (<150 DPI)
  }
}
