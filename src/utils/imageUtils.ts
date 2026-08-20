import { UploadedPhoto } from '../types/editor';

/**
 * 从图片文件中解析 EXIF 拍摄时间 (DateTimeOriginal / DateTime)
 * 采用原生高效二进制流扫描，支持 JPEG APP1 (0xFFE1) EXIF 块
 * 若无 EXIF 信息，则优雅回退至文件的 lastModified 时间戳
 */
export async function extractImageCaptureTime(file: File): Promise<number | undefined> {
  try {
    // 读取前 128KB 字节以获取 EXIF 头部
    const slice = file.slice(0, 131072);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    // 检查 JPEG SOI 标志 0xFFD8
    if (view.byteLength > 4 && view.getUint16(0, false) === 0xffd8) {
      let offset = 2;
      const length = view.byteLength;

      while (offset + 4 < length) {
        const marker = view.getUint16(offset, false);
        offset += 2;

        // APP1 标记 (EXIF 所在)
        if (marker === 0xffe1) {
          const app1Length = view.getUint16(offset, false);
          offset += 2;

          // 检查 "Exif\0\0" 头部 (0x45786966 0x0000)
          if (
            view.getUint32(offset, false) === 0x45786966 &&
            view.getUint16(offset + 4, false) === 0x0000
          ) {
            const tiffOffset = offset + 6;
            const isLittleEndian = view.getUint16(tiffOffset, false) === 0x4949; // 'II'

            // 验证 TIFF magic 42 (0x002A)
            if (view.getUint16(tiffOffset + 2, isLittleEndian) === 0x002a) {
              const ifd0Offset = view.getUint32(tiffOffset + 4, isLittleEndian);
              const result = parseIFDForDate(view, tiffOffset, tiffOffset + ifd0Offset, isLittleEndian);
              if (result) return result;
            }
          }
          break;
        } else if ((marker & 0xff00) === 0xff00 && marker !== 0xffd8 && marker !== 0xffd9) {
          // 跳过其他标记段
          const segmentLength = view.getUint16(offset, false);
          offset += segmentLength;
        } else {
          break;
        }
      }
    }
  } catch {
    // 容错降级
  }

  // 优雅回退：使用文件系统的最后修改时间
  if (file.lastModified && file.lastModified > 0 && file.lastModified <= Date.now() + 86400000) {
    return file.lastModified;
  }

  return undefined;
}

/**
 * 辅助解析 IFD 目录中的 0x9003 (DateTimeOriginal), 0x9004 (DateTimeDigitized), 0x0132 (DateTime)
 */
function parseIFDForDate(
  view: DataView,
  tiffOffset: number,
  ifdOffset: number,
  littleEndian: boolean
): number | undefined {
  if (ifdOffset + 2 > view.byteLength) return undefined;
  const numEntries = view.getUint16(ifdOffset, littleEndian);
  let subExifOffset = 0;

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    const tag = view.getUint16(entryOffset, littleEndian);

    // 0x8769: Exif IFD Pointer
    if (tag === 0x8769) {
      subExifOffset = view.getUint32(entryOffset + 8, littleEndian);
    }

    // 0x9003: DateTimeOriginal, 0x9004: DateTimeDigitized, 0x0132: DateTime
    if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
      const dateStr = readExifString(view, tiffOffset, entryOffset, littleEndian);
      if (dateStr) {
        const parsed = parseExifDateString(dateStr);
        if (parsed) return parsed;
      }
    }
  }

  // 递归进入 SubIFD 查找
  if (subExifOffset > 0) {
    const subIfdActual = tiffOffset + subExifOffset;
    if (subIfdActual + 2 <= view.byteLength) {
      const subEntries = view.getUint16(subIfdActual, littleEndian);
      for (let j = 0; j < subEntries; j++) {
        const entryOffset = subIfdActual + 2 + j * 12;
        if (entryOffset + 12 > view.byteLength) break;

        const tag = view.getUint16(entryOffset, littleEndian);
        if (tag === 0x9003 || tag === 0x9004 || tag === 0x0132) {
          const dateStr = readExifString(view, tiffOffset, entryOffset, littleEndian);
          if (dateStr) {
            const parsed = parseExifDateString(dateStr);
            if (parsed) return parsed;
          }
        }
      }
    }
  }

  return undefined;
}

function readExifString(
  view: DataView,
  tiffOffset: number,
  entryOffset: number,
  littleEndian: boolean
): string | null {
  const count = view.getUint32(entryOffset + 4, littleEndian);
  let valueOffset = entryOffset + 8;
  if (count > 4) {
    valueOffset = tiffOffset + view.getUint32(entryOffset + 8, littleEndian);
  }

  if (valueOffset + count > view.byteLength) return null;

  let str = '';
  for (let k = 0; k < count; k++) {
    const charCode = view.getUint8(valueOffset + k);
    if (charCode === 0) break;
    str += String.fromCharCode(charCode);
  }
  return str.trim();
}

function parseExifDateString(str: string): number | null {
  // EXIF 日期标准格式: "YYYY:MM:DD HH:MM:SS" 或 "YYYY-MM-DD HH:MM:SS"
  const match = str.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const min = parseInt(match[5], 10);
    const sec = parseInt(match[6], 10);
    const date = new Date(year, month, day, hour, min, sec);
    const time = date.getTime();
    if (!isNaN(time) && time > 0) return time;
  }
  return null;
}

/**
 * 将用户上传的本地 File 对象极速读取并生成 UploadedPhoto 资产对象 (全本地处理，不上传服务器)
 * 采用高效 ObjectURL + 极轻量缩略图双轨模型，毫秒级就绪，彻底避免大图 Base64 内存暴涨
 */
export async function processLocalImageFile(file: File): Promise<UploadedPhoto> {
  const captureTime = await extractImageCaptureTime(file);
  const originalBlobUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const naturalWidth = img.naturalWidth || 1000;
      const naturalHeight = img.naturalHeight || 1000;

      let aspectRatio: 'horizontal' | 'vertical' | 'square' = 'square';
      const ratio = naturalWidth / naturalHeight;
      if (ratio > 1.15) {
        aspectRatio = 'horizontal';
      } else if (ratio < 0.85) {
        aspectRatio = 'vertical';
      }

      // 1. 制作极轻量缩略图 (最大边 360px)，用于照片池瀑布流、拖拽手势和快速排版
      const thumbCanvas = document.createElement('canvas');
      const maxThumbSize = 360;
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

      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      const thumbCtx = thumbCanvas.getContext('2d');
      let thumbnailUrl = originalBlobUrl;
      if (thumbCtx) {
        try {
          thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);
          thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);
        } catch {
          thumbnailUrl = originalBlobUrl;
        }
      }

      const uniqueAssetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const photo: UploadedPhoto = {
        id: uniqueAssetId,
        assetId: uniqueAssetId,
        name: file.name,
        filename: file.name,
        mimeType: file.type,

        // 原图、预览图与缩略图分层对象
        original: {
          file,
          url: originalBlobUrl,
          width: naturalWidth,
          height: naturalHeight,
          fileSize: file.size,
        },
        preview: {
          url: originalBlobUrl,
          width: naturalWidth,
          height: naturalHeight,
        },
        thumbnail: {
          url: thumbnailUrl,
          width: thumbW,
          height: thumbH,
        },

        // 扁平化高效字段 (设计器与照片托盘高频访问)
        url: originalBlobUrl,
        thumbUrl: thumbnailUrl,
        thumbnailUrl: thumbnailUrl,
        previewUrl: originalBlobUrl,
        originalUrl: originalBlobUrl,

        // 真实物理与几何属性 (用于精确 DPI 清晰度判定与无损缩放)
        naturalWidth,
        naturalHeight,
        fileSize: file.size,
        usedCount: 0,
        aspectRatio,
        createdAt: Date.now(),
        captureTime: captureTime,

        uploadStatus: 'local',
      };

      resolve(photo);
    };

    img.onerror = () => {
      // 容错降级：若 Image 加载异常仍构建基础占位资产
      const uniqueAssetId = `asset_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const fallbackPhoto: UploadedPhoto = {
        id: uniqueAssetId,
        assetId: uniqueAssetId,
        name: file.name,
        filename: file.name,
        mimeType: file.type,
        url: originalBlobUrl,
        thumbUrl: originalBlobUrl,
        thumbnailUrl: originalBlobUrl,
        previewUrl: originalBlobUrl,
        originalUrl: originalBlobUrl,
        naturalWidth: 1200,
        naturalHeight: 800,
        fileSize: file.size,
        usedCount: 0,
        aspectRatio: 'horizontal',
        createdAt: Date.now(),
        uploadStatus: 'local',
      };
      resolve(fallbackPhoto);
    };

    img.src = originalBlobUrl;
  });
}

/**
 * 格式化文件大小为易读字符串 (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 格式化时间戳为规范字符串 (YYYY-MM-DD HH:mm:ss)
 */
export function formatDateTime(timestamp?: number): string {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) return '未知';
  const date = new Date(timestamp);
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
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
