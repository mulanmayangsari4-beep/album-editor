/**
 * 印刷级 300 DPI 高清导出与离线渲染引擎 (Print-Ready 300 DPI Rendering Engine)
 * 1. 真实 300 DPI EXIF/JFIF 元数据注入 (Photoshop / Windows 属性直接识别为 300 DPI)
 * 2. 1:1 像素级还原编辑器的相框几何、旋转、CSS Cover 裁切与缩放
 * 3. 纯净印刷图：默认无多余裁切线，无四周冗余留白
 * 4. 严格跳过未输入的占位文字，保证印刷成品干净无水印
 */

import { SpreadModel, PageModel, FrameSlot, BookSpec, UploadedPhoto } from '../types/editor';

export interface PrintExportOptions {
  spread: SpreadModel;
  bookSpec: BookSpec;
  photos: UploadedPhoto[];
  projectName?: string;
  scope?: 'spread' | 'leftPage' | 'rightPage';
  includeBleed?: boolean;      // 是否包含 3mm 出血位 (默认 false / 纯净成品图)
  includeCropMarks?: boolean;  // 是否绘制裁切角线 (默认 false)
  targetDpi?: number;          // 目标 DPI (默认 300)
  quality?: number;            // JPG 压缩质量 (0.1 ~ 1.0, 默认 0.98)
  onProgress?: (percent: number, message: string) => void;
}

export interface PrintExportResult {
  blob: Blob;
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  fileSizeBytes: number;
  fileName: string;
}

/**
 * 异步预加载图片并返回 HTMLImageElement
 */
function loadImageAsync(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // 跨域回退尝试
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      fallbackImg.src = url;
    };
    img.src = url;
  });
}

/**
 * 构造标准的 JFIF APP0 (0xFFE0) 标头段
 */
function createJfifApp0Segment(dpi: number = 300): Uint8Array {
  const segment = new Uint8Array(18 + 2); // 2 bytes marker + 16 bytes payload + 2 length
  const view = new DataView(segment.buffer);
  segment[0] = 0xff;
  segment[1] = 0xe0;
  view.setUint16(2, 16); // length = 16
  segment.set([0x4a, 0x46, 0x49, 0x46, 0x00], 4); // "JFIF\0"
  segment[9] = 0x01; // major 1
  segment[10] = 0x01; // minor 1
  segment[11] = 0x01; // units: 1 = dots per inch (DPI)
  view.setUint16(12, dpi); // Xdensity
  view.setUint16(14, dpi); // Ydensity
  segment[16] = 0x00; // Xthumbnail
  segment[17] = 0x00; // Ythumbnail
  return segment;
}

/**
 * 构造标准的 EXIF APP1 (0xFFE1) 标头段 (包含 XResolution/YResolution=300/1, ResolutionUnit=2)
 */
function createExifApp1Segment(dpi: number = 300): Uint8Array {
  const segment = new Uint8Array(74 + 2); // 2 bytes marker + 74 bytes payload
  const view = new DataView(segment.buffer);

  segment[0] = 0xff;
  segment[1] = 0xe1; // APP1
  view.setUint16(2, 74); // Length = 74

  // "Exif\0\0" (bytes 4..9)
  segment.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 4);

  const tiffStart = 10;
  // TIFF Header: 'MM' (Big Endian)
  segment[tiffStart] = 0x4d;
  segment[tiffStart + 1] = 0x4d;
  view.setUint16(tiffStart + 2, 42); // 0x002A
  view.setUint32(tiffStart + 4, 8); // Offset to IFD0 from tiffStart

  const ifd0Start = tiffStart + 8; // byte 18
  view.setUint16(ifd0Start, 3); // 3 directory entries

  // Entry 0: XResolution (Tag 0x011A, Type 5 = RATIONAL, Count 1, Offset to rational data = 50)
  view.setUint16(ifd0Start + 2, 0x011a);
  view.setUint16(ifd0Start + 4, 5);
  view.setUint32(ifd0Start + 6, 1);
  view.setUint32(ifd0Start + 10, 50);

  // Entry 1: YResolution (Tag 0x011B, Type 5 = RATIONAL, Count 1, Offset to rational data = 58)
  view.setUint16(ifd0Start + 14, 0x011b);
  view.setUint16(ifd0Start + 16, 5);
  view.setUint32(ifd0Start + 18, 1);
  view.setUint32(ifd0Start + 22, 58);

  // Entry 2: ResolutionUnit (Tag 0x0128, Type 3 = SHORT, Count 1, Value 2 = inches)
  view.setUint16(ifd0Start + 26, 0x0128);
  view.setUint16(ifd0Start + 28, 3);
  view.setUint32(ifd0Start + 30, 1);
  view.setUint16(ifd0Start + 34, 2); // 2 = inches
  view.setUint16(ifd0Start + 36, 0); // padding

  // Next IFD Offset (0)
  view.setUint32(ifd0Start + 38, 0);

  // Rational data for XResolution (tiffStart + 50 = byte 60)
  view.setUint32(tiffStart + 50, dpi); // numerator (300)
  view.setUint32(tiffStart + 54, 1); // denominator (1)

  // Rational data for YResolution (tiffStart + 58 = byte 68)
  view.setUint32(tiffStart + 58, dpi); // numerator (300)
  view.setUint32(tiffStart + 62, 1); // denominator (1)

  return segment;
}

/**
 * 构造 Adobe Photoshop 专属 APP13 (0xFFED) 8BIM ResolutionInfo 标头段
 * Photoshop 读取此标头后会 100% 识别为 300 像素/英寸并精准换算厘米物理尺寸
 */
function createAdobeApp13Segment(dpi: number = 300): Uint8Array {
  const segment = new Uint8Array(44 + 2); // 2 bytes marker + 44 bytes payload
  const view = new DataView(segment.buffer);

  segment[0] = 0xff;
  segment[1] = 0xed; // APP13
  view.setUint16(2, 44); // Length = 44

  // "Photoshop 3.0\0" (bytes 4..17)
  const psHeader = [0x50, 0x68, 0x6f, 0x74, 0x6f, 0x73, 0x68, 0x6f, 0x70, 0x20, 0x33, 0x2e, 0x30, 0x00];
  segment.set(psHeader, 4);

  // "8BIM" (bytes 18..21)
  segment.set([0x38, 0x42, 0x49, 0x4d], 18);

  // Resource ID: 0x03ED (ResolutionInfo) (bytes 22..23)
  view.setUint16(22, 0x03ed);

  // Name: empty Pascal string padded to even (bytes 24..25)
  segment[24] = 0x00;
  segment[25] = 0x00;

  // Size of resource: 16 bytes (bytes 26..29)
  view.setUint32(26, 16);

  // ResolutionInfo data:
  // hRes: 32-bit fixed point (dpi in integer part, 0 in fraction) (bytes 30..33)
  view.setUint32(30, dpi << 16);
  // hResUnit: 1 = pixels/inch (bytes 34..35)
  view.setUint16(34, 1);
  // widthUnit: 2 = cm (bytes 36..37)
  view.setUint16(36, 2);
  // vRes: 32-bit fixed point (dpi in integer part, 0 in fraction) (bytes 38..41)
  view.setUint32(38, dpi << 16);
  // vResUnit: 1 = pixels/inch (bytes 42..43)
  view.setUint16(42, 1);
  // heightUnit: 2 = cm (bytes 44..45)
  view.setUint16(44, 2);

  return segment;
}

/**
 * 将完整的 300 DPI 元数据 (JFIF APP0 + EXIF APP1 + Adobe 8BIM APP13) 注入 JPEG 二进制中
 * 确保在 Photoshop、Illustrator、InDesign、Windows 属性及印厂 RIP 系统中直接识别为 300 DPI
 */
function setJpegDpi(blob: Blob, dpi: number = 300): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function () {
      const buffer = reader.result as ArrayBuffer;
      const view = new DataView(buffer);

      // 验证 JPEG SOI (0xFFD8)
      if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) {
        resolve(blob);
        return;
      }

      // 寻找现有 JPEG 中首个非 APP marker 的位置 (跳过原有的 APP0/APP1/APP13 等)
      let offset = 2;
      while (offset < view.byteLength) {
        const marker = view.getUint16(offset);
        // APP0 (0xFFE0) 到 APP15 (0xFFEF) 或 COM (0xFFFE)
        if ((marker >= 0xffe0 && marker <= 0xffef) || marker === 0xfffe) {
          const segLen = view.getUint16(offset + 2);
          offset += 2 + segLen;
        } else {
          break;
        }
      }

      const jfifSeg = createJfifApp0Segment(dpi);
      const exifSeg = createExifApp1Segment(dpi);
      const adobeSeg = createAdobeApp13Segment(dpi);

      const headerTotalLength = jfifSeg.length + exifSeg.length + adobeSeg.length;
      const remainingBytes = buffer.byteLength - offset;

      const newBuffer = new Uint8Array(2 + headerTotalLength + remainingBytes);
      // 写入 SOI (0xFFD8)
      newBuffer[0] = 0xff;
      newBuffer[1] = 0xd8;

      let writePos = 2;
      // 写入 JFIF APP0
      newBuffer.set(jfifSeg, writePos);
      writePos += jfifSeg.length;

      // 写入 Adobe 8BIM APP13 (Photoshop 绝对优先识别)
      newBuffer.set(adobeSeg, writePos);
      writePos += adobeSeg.length;

      // 写入 EXIF APP1
      newBuffer.set(exifSeg, writePos);
      writePos += exifSeg.length;

      // 写入后续图像数据 (DQT, DHT, SOF0, SOS 等)
      newBuffer.set(new Uint8Array(buffer.slice(offset)), writePos);

      resolve(new Blob([newBuffer], { type: 'image/jpeg' }));
    };
    reader.onerror = () => resolve(blob);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * 绘制各种相框几何路径 (矩形、圆角矩形、异形遮罩)
 */
function traceSlotPath(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  borderRadius: number,
  maskShape?: string
) {
  ctx.beginPath();
  if (maskShape === 'circle') {
    ctx.arc(0, 0, Math.min(w, h) / 2, 0, Math.PI * 2);
  } else if (maskShape === 'heart') {
    const pts = [
      [0.50, 0.15], [0.62, 0.00], [0.82, 0.00], [1.00, 0.18],
      [1.00, 0.40], [0.50, 0.95], [0.00, 0.40], [0.00, 0.18],
      [0.18, 0.00], [0.38, 0.00],
    ];
    pts.forEach(([px, py], i) => {
      const x = (px - 0.5) * w;
      const y = (py - 0.5) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  } else if (maskShape === 'star') {
    const pts = [
      [0.50, 0.00], [0.61, 0.35], [0.98, 0.35], [0.68, 0.57],
      [0.79, 0.91], [0.50, 0.70], [0.21, 0.91], [0.32, 0.57],
      [0.02, 0.35], [0.39, 0.35],
    ];
    pts.forEach(([px, py], i) => {
      const x = (px - 0.5) * w;
      const y = (py - 0.5) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  } else if (maskShape === 'diamond') {
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(-w / 2, 0);
    ctx.closePath();
  } else if (maskShape === 'triangle') {
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
  } else if (maskShape === 'hexagon') {
    const pts = [
      [0.25, 0.00], [0.75, 0.00], [1.00, 0.50],
      [0.75, 1.00], [0.25, 1.00], [0.00, 0.50],
    ];
    pts.forEach(([px, py], i) => {
      const x = (px - 0.5) * w;
      const y = (py - 0.5) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
  } else if (maskShape === 'arch') {
    const r = w / 2;
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(-w / 2, -h / 2 + r);
    ctx.arc(0, -h / 2 + r, r, Math.PI, 0);
    ctx.lineTo(w / 2, h / 2);
    ctx.closePath();
  } else if (borderRadius > 0) {
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(-w / 2, -h / 2, w, h, borderRadius);
    } else {
      const r = Math.min(borderRadius, w / 2, h / 2);
      ctx.moveTo(-w / 2 + r, -h / 2);
      ctx.lineTo(w / 2 - r, -h / 2);
      ctx.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      ctx.lineTo(w / 2, h / 2 - r);
      ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      ctx.lineTo(-w / 2 + r, h / 2);
      ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      ctx.lineTo(-w / 2, -h / 2 + r);
      ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      ctx.closePath();
    }
  } else {
    ctx.rect(-w / 2, -h / 2, w, h);
  }
}

/**
 * 绘制单个页面 (PageModel) 的所有元素到指定区域
 */
function renderPageToCanvas(
  ctx: CanvasRenderingContext2D,
  page: PageModel,
  pageOriginX: number,
  pageOriginY: number,
  pageWidthPx: number,
  pageHeightPx: number,
  loadedImages: Map<string, HTMLImageElement>
) {
  ctx.save();
  ctx.translate(pageOriginX, pageOriginY);

  // 1. 绘制页面背景底色
  ctx.fillStyle = page.backgroundColor || '#ffffff';
  ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);

  // 2. 循环绘制每个画框 / 槽位 (slots)
  for (const slot of page.slots) {
    if (slot.visible === false) continue;

    // 严谨计算：X 对应 pageWidthPx，Y 对应 pageHeightPx！
    const slotX = (slot.x / 100) * pageWidthPx;
    const slotY = (slot.y / 100) * pageHeightPx;
    const slotW = (slot.width / 100) * pageWidthPx;
    const slotH = (slot.height / 100) * pageHeightPx;
    const slotRotation = slot.rotation || 0;

    const photoId = slot.photoId || slot.assetId;
    const imgElem = photoId ? loadedImages.get(photoId) : null;

    ctx.save();

    // 全局不透明度
    if (slot.opacity !== undefined && slot.opacity < 1) {
      ctx.globalAlpha = slot.opacity;
    }

    // 旋转中心位于相框几何中心
    const centerX = slotX + slotW / 2;
    const centerY = slotY + slotH / 2;
    ctx.translate(centerX, centerY);
    if (slotRotation !== 0) {
      ctx.rotate((slotRotation * Math.PI) / 180);
    }

    if (slot.type === 'text') {
      // 文本元素：印刷质检规则 —— 占位提示文字绝对不打印！
      const userText = slot.text?.trim();
      const isPlaceholder = !userText || userText === slot.placeholderText?.trim();

      if (!isPlaceholder && userText) {
        ctx.fillStyle = slot.textColor || '#333333';
        // 基于 300 DPI 高分辨率换算字号
        const fontSizePx = Math.max(14, ((slot.fontSize || 14) / 100) * pageHeightPx);
        ctx.font = `${fontSizePx}px ${slot.fontFamily || 'sans-serif'}`;
        ctx.textAlign = slot.textAlign || 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(userText, 0, 0);
      }
    } else {
      // 照片框：计算按 300 DPI 比例换算的圆角与描边粗细
      const previewRefWidth = 500; // 屏幕预览基准尺寸 (px)
      const scaleToDpi = pageWidthPx / previewRefWidth;
      const scaledBorderRadius = slot.borderRadius ? slot.borderRadius * scaleToDpi : 0;
      const hasBorder = !!(slot.borderWidth && slot.borderWidth > 0);
      const scaledBorderWidth = hasBorder ? Math.max(1, (slot.borderWidth || 0) * scaleToDpi) : 0;

      // 1. 照片内容绘制（带几何造型遮罩与裁剪）
      ctx.save();
      traceSlotPath(ctx, slotW, slotH, scaledBorderRadius, slot.maskShape);
      ctx.clip();

      if (imgElem && imgElem.naturalWidth > 0 && imgElem.naturalHeight > 0) {
        const nw = imgElem.naturalWidth;
        const nh = imgElem.naturalHeight;

        // 适应模式：cover (铺满裁剪) 或 contain (完整适应)
        const isContain = slot.fitMode === 'contain';
        const baseScale = isContain ? Math.min(slotW / nw, slotH / nh) : Math.max(slotW / nw, slotH / nh);
        const baseW = nw * baseScale;
        const baseH = nh * baseScale;

        // 用户缩放倍率
        const userScale = slot.crop?.scale || 1.0;
        const drawW = baseW * userScale;
        const drawH = baseH * userScale;

        // 用户平移偏移 (crop.x, crop.y 默认均为 50，即中心)
        const cropX = slot.crop?.x !== undefined ? slot.crop.x : 50;
        const cropY = slot.crop?.y !== undefined ? slot.crop.y : 50;

        // 计算位移量
        const objectPositionOffsetX = isContain ? 0 : ((50 - cropX) / 100) * (baseW - slotW);
        const objectPositionOffsetY = isContain ? 0 : ((50 - cropY) / 100) * (baseH - slotH);
        const scaleZoomOffsetX = isContain ? 0 : ((50 - cropX) * (userScale - 1) * 0.5 / 100) * slotW;
        const scaleZoomOffsetY = isContain ? 0 : ((50 - cropY) * (userScale - 1) * 0.5 / 100) * slotH;

        const totalOffsetX = objectPositionOffsetX + scaleZoomOffsetX;
        const totalOffsetY = objectPositionOffsetY + scaleZoomOffsetY;

        // 翻转支持
        if (slot.flipH) {
          ctx.scale(-1, 1);
        }
        if (slot.flipV) {
          ctx.scale(1, -1);
        }

        // 照片内部旋转
        if (slot.crop?.rotation) {
          ctx.rotate((slot.crop.rotation * Math.PI) / 180);
        }

        // 高质量绘制
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          imgElem,
          -drawW / 2 + totalOffsetX,
          -drawH / 2 + totalOffsetY,
          drawW,
          drawH
        );
      } else {
        // 空相框：印刷成品保持纯净底色（或透明）
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-slotW / 2, -slotH / 2, slotW, slotH);
      }
      ctx.restore();

      // 2. 照片描边绘制 (1:1 还原编辑器描边粗细与颜色)
      if (hasBorder && scaledBorderWidth > 0) {
        ctx.save();
        traceSlotPath(ctx, slotW, slotH, scaledBorderRadius, slot.maskShape);
        ctx.lineWidth = scaledBorderWidth;
        ctx.strokeStyle = slot.borderColor || '#ffffff';
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * 核心导出函数：生成 100% 真实 300 DPI 的纯净印刷 JPG
 */
export async function exportSpreadToPrintJpg(options: PrintExportOptions): Promise<PrintExportResult> {
  const {
    spread,
    bookSpec,
    photos,
    projectName = '我的照片书',
    scope = 'spread',
    includeBleed = false, // 默认纯净印刷成品图 (无多余出血外延)
    includeCropMarks = false, // 默认无裁切线
    targetDpi = 300,
    quality = 0.98,
    onProgress,
  } = options;

  onProgress?.(10, '正在初始化 300 DPI 印刷级高精画布...');

  // 1. 物理毫米到 300 DPI 像素换算 (1 inch = 25.4 mm)
  const pxPerMm = targetDpi / 25.4;

  const singlePageTrimWidthPx = Math.round(bookSpec.widthMm * pxPerMm);
  const singlePageTrimHeightPx = Math.round(bookSpec.heightMm * pxPerMm);

  const bleedMm = includeBleed ? (bookSpec.bleedMm || 3) : 0;
  const bleedPx = Math.round(bleedMm * pxPerMm);

  const isDualSpread = scope === 'spread';
  const trimWidthPx = isDualSpread ? singlePageTrimWidthPx * 2 : singlePageTrimWidthPx;
  const trimHeightPx = singlePageTrimHeightPx;

  // 画布实际总尺寸 (若不要裁切线，画布紧贴成品/出血边界，零多余黑白边)
  const canvasWidthPx = trimWidthPx + 2 * bleedPx;
  const canvasHeightPx = trimHeightPx + 2 * bleedPx;

  onProgress?.(25, '正在预加载页面中使用的高清照片...');

  // 2. 收集需要渲染的照片资产
  const photoMap = new Map<string, UploadedPhoto>(photos.map((p) => [p.id, p]));
  const neededPhotoIds = new Set<string>();

  const pagesToRender: { page: PageModel; isLeft: boolean }[] = [];
  if (scope === 'spread') {
    pagesToRender.push({ page: spread.leftPage, isLeft: true });
    pagesToRender.push({ page: spread.rightPage, isLeft: false });
  } else if (scope === 'leftPage') {
    pagesToRender.push({ page: spread.leftPage, isLeft: true });
  } else {
    pagesToRender.push({ page: spread.rightPage, isLeft: false });
  }

  for (const { page } of pagesToRender) {
    for (const slot of page.slots) {
      const pid = slot.photoId || slot.assetId;
      if (pid) neededPhotoIds.add(pid);
    }
  }

  // 3. 异步并发加载高清图片资源
  const loadedImages = new Map<string, HTMLImageElement>();
  const totalToLoad = neededPhotoIds.size;
  let loadedCount = 0;

  await Promise.all(
    Array.from(neededPhotoIds).map(async (pid) => {
      const photoObj = photoMap.get(pid);
      if (!photoObj) return;
      const imageUrl = photoObj.originalUrl || photoObj.url || photoObj.thumbUrl;
      try {
        const img = await loadImageAsync(imageUrl);
        loadedImages.set(pid, img);
      } catch (err) {
        console.warn(`Print engine warning: failed to load full image for photo ${pid}`, err);
      }
      loadedCount++;
      const pct = Math.round(25 + (loadedCount / Math.max(1, totalToLoad)) * 40);
      onProgress?.(pct, `正在加载高清照片 (${loadedCount}/${totalToLoad})...`);
    })
  );

  onProgress?.(70, '正在执行 300 DPI 印刷级高精合成...');

  // 4. 创建 300 DPI 离线 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidthPx;
  canvas.height = canvasHeightPx;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Failed to create canvas 2D context for print rendering');
  }

  // 默认底色纯白
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);

  const contentOriginX = bleedPx;
  const contentOriginY = bleedPx;

  // 5. 渲染各页面
  if (scope === 'spread') {
    // 渲染左页
    renderPageToCanvas(
      ctx,
      spread.leftPage,
      contentOriginX,
      contentOriginY,
      singlePageTrimWidthPx,
      singlePageTrimHeightPx,
      loadedImages
    );

    // 渲染右页 (紧密贴合在中缝)
    renderPageToCanvas(
      ctx,
      spread.rightPage,
      contentOriginX + singlePageTrimWidthPx,
      contentOriginY,
      singlePageTrimWidthPx,
      singlePageTrimHeightPx,
      loadedImages
    );
  } else {
    // 渲染单页
    const pageToRender = scope === 'leftPage' ? spread.leftPage : spread.rightPage;
    renderPageToCanvas(
      ctx,
      pageToRender,
      contentOriginX,
      contentOriginY,
      singlePageTrimWidthPx,
      singlePageTrimHeightPx,
      loadedImages
    );
  }

  onProgress?.(90, '正在写入 300 DPI 物理分辨率元数据并编码 JPG...');

  // 6. 导出为 JPG Blob
  const rawBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to generate image blob'));
      },
      'image/jpeg',
      quality
    );
  });

  // 7. 注入真实的 300 DPI JFIF 头 (使得 PS/系统看图软件直接识别为 300 DPI)
  const finalBlob = await setJpegDpi(rawBlob, targetDpi);

  const dataUrl = URL.createObjectURL(finalBlob);
  const spreadNumber = spread.spreadIndex + 1;
  const scopeText = scope === 'spread' ? `第${spreadNumber}跨页_双页展开` : (scope === 'leftPage' ? `第${spread.leftPage.pageNumber}页` : `第${spread.rightPage.pageNumber}页`);
  const fileName = `${projectName}_${scopeText}_300DPI_印刷图_${canvasWidthPx}x${canvasHeightPx}px.jpg`;

  onProgress?.(100, '生成完毕！');

  return {
    blob: finalBlob,
    dataUrl,
    widthPx: canvasWidthPx,
    heightPx: canvasHeightPx,
    fileSizeBytes: finalBlob.size,
    fileName,
  };
}

/**
 * 触发浏览器本地下载文件
 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
