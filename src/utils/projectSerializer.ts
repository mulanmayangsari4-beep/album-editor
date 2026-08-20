import {
  ProjectDocument,
  SpreadModel,
  UploadedPhoto,
  ProductSpec,
  OrderSnapshot,
  CURRENT_SCHEMA_VERSION,
  FrameSlot,
} from '../types/editor';

/**
 * 物理毫米与百分比坐标换算工具
 * 保证设计器的 Source of Truth 始终具有清晰的物理毫米基准
 */
export function mmToPercent(mm: number, totalMm: number): number {
  if (totalMm <= 0) return 0;
  return (mm / totalMm) * 100;
}

export function percentToMm(percent: number, totalMm: number): number {
  return (percent / 100) * totalMm;
}

/**
 * 印前 DPI 像素换算器 (Print Resolution Converter)
 * 工业印刷标准: 300 DPI (1 英寸 = 25.4 毫米)
 */
export function mmToPrintPixels(mm: number, dpi: number = 300): number {
  return Math.round((mm / 25.4) * dpi);
}

/**
 * 将槽位的百分比坐标转换为实际物理毫米 (宽/高/X/Y)
 */
export function getSlotPhysicalMm(
  slot: FrameSlot,
  pageWidthMm: number,
  pageHeightMm: number
): { xMm: number; yMm: number; widthMm: number; heightMm: number } {
  const xMm = slot.xMm !== undefined ? slot.xMm : Number(percentToMm(slot.x, pageWidthMm).toFixed(2));
  const yMm = slot.yMm !== undefined ? slot.yMm : Number(percentToMm(slot.y, pageHeightMm).toFixed(2));
  const widthMm = slot.widthMm !== undefined ? slot.widthMm : Number(percentToMm(slot.width, pageWidthMm).toFixed(2));
  const heightMm = slot.heightMm !== undefined ? slot.heightMm : Number(percentToMm(slot.height, pageHeightMm).toFixed(2));
  return { xMm, yMm, widthMm, heightMm };
}

/**
 * 数据迁移与向下兼容装载器 (Schema Migration Engine)
 * 当读取未来或过去的旧版本 JSON 存档时，执行渐进式数据补全与标准化
 */
export function migrateProjectDocument(rawJson: unknown): ProjectDocument {
  const data = (rawJson || {}) as Record<string, any>;

  const version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;

  // 1. 规范化 Project 基础字段
  const projectId = data.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = data.name || data.title || '我的照片书';
  const createdAt = data.createdAt || Date.now();
  const updatedAt = data.updatedAt || Date.now();

  // 2. 规范化商品规格 spec
  const rawSpec = data.productSpec || data.spec || {};
  const productSpec: ProductSpec = {
    id: rawSpec.id || 'square_8inch_book',
    productType: rawSpec.productType || 'photobook',
    name: rawSpec.name || '完美好翻书-方8寸',
    categoryName: rawSpec.categoryName || '照片书',
    widthMm: rawSpec.widthMm || 200,
    heightMm: rawSpec.heightMm || 200,
    bleedMm: typeof rawSpec.bleedMm === 'number' ? rawSpec.bleedMm : 3,
    safeMarginMm: typeof rawSpec.safeMarginMm === 'number' ? rawSpec.safeMarginMm : 6,
    defaultPages: rawSpec.defaultPages || 20,
    minPages: rawSpec.minPages || 16,
    maxPages: rawSpec.maxPages || 80,
    pageStep: rawSpec.pageStep || 2,
    canvasPixelSize: rawSpec.canvasPixelSize || 2027,
    layoutMode: rawSpec.layoutMode || 'dual_spread',
  };

  // 3. 规范化跨页与元素 (补全 assetId, opacity, locked, visible 等通用属性)
  const spreads: SpreadModel[] = Array.isArray(data.spreads)
    ? data.spreads.map((spread: any, sIdx: number) => ({
        id: spread.id || `spread_${sIdx}`,
        spreadIndex: typeof spread.spreadIndex === 'number' ? spread.spreadIndex : sIdx,
        type: spread.type || 'spread',
        name: spread.name,
        leftPage: {
          id: spread.leftPage?.id || `page_L_${sIdx}`,
          pageNumber: spread.leftPage?.pageNumber ?? sIdx * 2,
          isLeft: true,
          backgroundColor: spread.leftPage?.backgroundColor || '#ffffff',
          backgroundImage: spread.leftPage?.backgroundImage,
          slots: Array.isArray(spread.leftPage?.slots)
            ? spread.leftPage.slots.map((s: any) => normalizeSlot(s, productSpec.widthMm, productSpec.heightMm))
            : [],
        },
        rightPage: {
          id: spread.rightPage?.id || `page_R_${sIdx}`,
          pageNumber: spread.rightPage?.pageNumber ?? sIdx * 2 + 1,
          isLeft: false,
          backgroundColor: spread.rightPage?.backgroundColor || '#ffffff',
          backgroundImage: spread.rightPage?.backgroundImage,
          slots: Array.isArray(spread.rightPage?.slots)
            ? spread.rightPage.slots.map((s: any) => normalizeSlot(s, productSpec.widthMm, productSpec.heightMm))
            : [],
        },
      }))
    : [];

  // 4. 规范化照片资产库 (保证 assetId 唯一性，保留原图/缩略图分层与 AI 视觉分析元数据)
  const photos: UploadedPhoto[] = Array.isArray(data.photos)
    ? data.photos.map((p: any) => ({
        id: p.id || p.assetId || `photo_${Math.random().toString(36).substring(2, 8)}`,
        assetId: p.assetId || p.id,
        name: p.name || '未命名图片',
        filename: p.filename || p.name,
        mimeType: p.mimeType,
        url: p.previewUrl || p.url || '',
        thumbUrl: p.thumbnailUrl || p.thumbUrl || p.url || '',
        thumbnailUrl: p.thumbnailUrl || p.thumbUrl || p.url || '',
        previewUrl: p.previewUrl || p.url || '',
        originalUrl: p.originalUrl || p.url || '',
        naturalWidth: p.naturalWidth || 1000,
        naturalHeight: p.naturalHeight || 1000,
        fileSize: p.fileSize || 0,
        usedCount: p.usedCount || 0,
        aspectRatio: p.aspectRatio || 'horizontal',
        createdAt: p.createdAt || Date.now(),
        captureTime: p.captureTime,
        uploadStatus: p.uploadStatus || 'local',
        storageKey: p.storageKey,
        aiAnalysis: p.aiAnalysis,
      }))
    : [];

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: projectId,
    title,
    productSpec,
    spreads,
    photos,
    createdAt,
    updatedAt,
  };
}

export function normalizeSlot(slot: any, pageWidthMm: number = 200, pageHeightMm: number = 200): FrameSlot {
  // 1. 确立物理毫米 (mm) 为唯一真值 Source of Truth
  const xMm = typeof slot.xMm === 'number'
    ? Number(slot.xMm.toFixed(2))
    : Number(percentToMm(typeof slot.x === 'number' ? slot.x : 0, pageWidthMm).toFixed(2));

  const yMm = typeof slot.yMm === 'number'
    ? Number(slot.yMm.toFixed(2))
    : Number(percentToMm(typeof slot.y === 'number' ? slot.y : 0, pageHeightMm).toFixed(2));

  const widthMm = typeof slot.widthMm === 'number'
    ? Number(slot.widthMm.toFixed(2))
    : Number(percentToMm(typeof slot.width === 'number' ? slot.width : 50, pageWidthMm).toFixed(2));

  const heightMm = typeof slot.heightMm === 'number'
    ? Number(slot.heightMm.toFixed(2))
    : Number(percentToMm(typeof slot.height === 'number' ? slot.height : 50, pageHeightMm).toFixed(2));

  // 2. 根据 mm 严格派生百分比渲染值 (避免双源数据漂移)
  const x = Number(mmToPercent(xMm, pageWidthMm).toFixed(4));
  const y = Number(mmToPercent(yMm, pageHeightMm).toFixed(4));
  const width = Number(mmToPercent(widthMm, pageWidthMm).toFixed(4));
  const height = Number(mmToPercent(heightMm, pageHeightMm).toFixed(4));

  return {
    id: slot.id || `slot_${Math.random().toString(36).substring(2, 7)}`,
    type: slot.type || 'photo',
    x,
    y,
    width,
    height,
    xMm,
    yMm,
    widthMm,
    heightMm,
    rotation: typeof slot.rotation === 'number' ? slot.rotation : 0,
    opacity: typeof slot.opacity === 'number' ? slot.opacity : 1,
    locked: Boolean(slot.locked || slot.isLocked),
    visible: slot.visible !== undefined ? Boolean(slot.visible) : true,
    zIndex: typeof slot.zIndex === 'number' ? slot.zIndex : 1,
    // 资产 ID 映射
    assetId: slot.assetId || slot.photoId,
    photoId: slot.photoId || slot.assetId,
    crop: slot.crop
      ? {
          x: slot.crop.x || 0,
          y: slot.crop.y || 0,
          scale: slot.crop.scale || 1,
          rotation: slot.crop.rotation || 0,
        }
      : undefined,
    placeholderText: slot.placeholderText,
    text: slot.text,
    fontSize: slot.fontSize,
    fontFamily: slot.fontFamily,
    textColor: slot.textColor,
    textAlign: slot.textAlign,
    aspectRatioHint: slot.aspectRatioHint,
    pixelLabel: slot.pixelLabel,
  };
}

/**
 * 生产并冻结一个不可变的订单快照 (Immutable Order Snapshot)
 * 用户后续对当前草稿的任何二次修改，均绝对无法篡改已生成的订单快照
 */
export function createImmutableOrderSnapshot(params: {
  project: ProjectDocument;
  quantity?: number;
  unitPrice?: number;
  currency?: string;
  options?: {
    coverMaterial?: string;
    paperType?: string;
    packaging?: string;
  };
}): OrderSnapshot {
  const { project, quantity = 1, unitPrice = 99.0, currency = 'CNY', options = {} } = params;

  // 使用纯深拷贝完全断开内存引用
  const frozenProject: ProjectDocument = JSON.parse(JSON.stringify(project));
  const frozenSpec: ProductSpec = JSON.parse(JSON.stringify(project.productSpec));

  // 统计印刷实际页数与有效图片资产列表
  const totalPages = frozenProject.spreads.length * 2;
  const referencedAssetIds = new Set<string>();

  frozenProject.spreads.forEach((s) => {
    s.leftPage.slots.forEach((slot) => {
      if (slot.assetId) referencedAssetIds.add(slot.assetId);
    });
    s.rightPage.slots.forEach((slot) => {
      if (slot.assetId) referencedAssetIds.add(slot.assetId);
    });
  });

  const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    snapshotId,
    snapshotVersion: CURRENT_SCHEMA_VERSION,
    createdAt: Date.now(),
    frozenProject,
    productSpec: frozenSpec,
    quantity,
    unitPrice,
    currency,
    selectedOptions: {
      coverMaterial: options.coverMaterial || (frozenSpec.coverType === 'hardcover' ? '精装硬壳覆哑膜' : '软精装进口哑粉'),
      paperType: options.paperType || '200g 顶级超感哑粉纸',
      packaging: options.packaging || '环保牛皮纸防震礼盒',
    },
    printSummary: {
      pageCount: totalPages,
      totalPhotosUsed: referencedAssetIds.size,
      totalPhysicalWidthMm: frozenSpec.widthMm * 2 + (frozenSpec.binding?.spineWidthMm || 0),
      totalPhysicalHeightMm: frozenSpec.heightMm,
      bleedMm: frozenSpec.bleedMm,
    },
  };
}
