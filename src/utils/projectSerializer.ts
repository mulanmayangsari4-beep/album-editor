import {
  ProjectDocument,
  SpreadModel,
  PageModel,
  UploadedPhoto,
  ProductSpec,
  ProductSpecSnapshot,
  OrderSnapshot,
  CURRENT_SCHEMA_VERSION,
  FrameSlot,
  PageFaceType,
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
 * 
 * 核心架构保障：
 * 1. pages 作为跨产品族唯一的 Source of Truth 页面列表。
 * 2. 自动补充 ProductSpecSnapshot 隔离历史产品修改。
 * 3. 自动保留与提取 designAssets 清单。
 * 4. 自动为旧工程补充解耦的 pageSpec, coverSpec, bindingSpec, exportSpec 与 capabilities。
 */
export function migrateProjectDocument(rawJson: unknown): ProjectDocument {
  const data = (rawJson || {}) as Record<string, any>;

  // 1. 规范化 Project 基础字段
  const projectId = data.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const title = data.name || data.title || '我的设计工程';
  const createdAt = data.createdAt || Date.now();
  const updatedAt = data.updatedAt || Date.now();

  // 2. 规范化商品规格 spec，构建解耦的全新规格体系
  const rawSpec = data.productSpec || data.spec || {};
  const widthMm = rawSpec.pageSpec?.widthMm || rawSpec.widthMm || 200;
  const heightMm = rawSpec.pageSpec?.heightMm || rawSpec.heightMm || 200;
  const bleedMm = typeof rawSpec.pageSpec?.bleedMm === 'number'
    ? rawSpec.pageSpec.bleedMm
    : (typeof rawSpec.bleedMm === 'number' ? rawSpec.bleedMm : 3);
  const safeMarginMm = typeof rawSpec.pageSpec?.safeMarginMm === 'number'
    ? rawSpec.pageSpec.safeMarginMm
    : (typeof rawSpec.safeMarginMm === 'number' ? rawSpec.safeMarginMm : 6);

  const productSpec: ProductSpec = {
    id: rawSpec.id || 'square_8inch_book',
    version: typeof rawSpec.version === 'number' ? rawSpec.version : 1,
    productType: rawSpec.productType || 'photobook',
    name: rawSpec.name || '完美好翻书-方8寸',
    categoryName: rawSpec.categoryName || '照片书',
    description: rawSpec.description || '经典方本照片书',
    sizeCategory: rawSpec.sizeCategory || `${widthMm}x${heightMm}mm`,
    layoutMode: rawSpec.layoutMode || 'dual_spread',
    
    // 独立解耦的内页物理规格
    pageSpec: {
      widthMm,
      heightMm,
      bleedMm,
      safeMarginMm,
      innerGutterSafeMarginMm: rawSpec.pageSpec?.innerGutterSafeMarginMm ?? 5,
    },

    // 独立封面规格
    coverSpec: rawSpec.coverSpec || {
      materialType: rawSpec.coverType === 'hardcover' ? 'hardcover_board' : 'photo_paper',
      designable: true,
      widthMm,
      heightMm,
      bleedMm,
      safeMarginMm,
      spineRule: {
        type: rawSpec.binding?.spineWidthMm ? 'fixed' : 'none',
        fixedWidthMm: rawSpec.binding?.spineWidthMm || 5,
      },
    },

    // 独立装订规格
    bindingSpec: rawSpec.bindingSpec || {
      bindingType: rawSpec.binding?.type === 'layflat_seamless' ? 'layflat' : 'perfect_binding',
      name: rawSpec.binding?.type === 'layflat_seamless' ? '蝴蝶对裱平摊' : '胶装',
      bindingEdge: rawSpec.binding?.bindingEdge || 'left',
      gutterHingeMm: rawSpec.binding?.gutterSafetyMm || 5,
      isLayflat: rawSpec.binding?.type === 'layflat_seamless' || rawSpec.binding?.type === 'glue_layflat',
    },

    // 独立导出规格
    exportSpec: rawSpec.exportSpec || {
      dpi: 300,
      colorSpace: 'RGB',
      exportFormat: 'zip_jpg',
      includeBleedInExport: true,
      renderCropMarks: true,
    },

    // 独立能力矩阵
    capabilities: rawSpec.capabilities || {
      allowCoverDesign: true,
      allowText: true,
      allowSticker: true,
      allowAI: true,
      allowMultiPhotoLayout: true,
      allowPageAddDelete: true,
      allowMaskShape: true,
      allowBackgroundChange: true,
    },

    defaultPages: rawSpec.defaultPages || 20,
    minPages: rawSpec.minPages || 16,
    maxPages: rawSpec.maxPages || 80,
    pageStep: rawSpec.pageStep || 2,
    canvasPixelSize: rawSpec.canvasPixelSize || 2027,

    // 兼容老代码顶层字段
    widthMm,
    heightMm,
    bleedMm,
    safeMarginMm,
    binding: rawSpec.binding || {
      type: 'glue_layflat',
      spineWidthMm: 5,
      gutterSafetyMm: 5,
      bindingEdge: 'left',
    },
    allowedElementTypes: rawSpec.allowedElementTypes || ['photo', 'text', 'stamp', 'shape'],
    coverType: rawSpec.coverType || 'softcover',
  };

  // 3. 规范化 pages 与 spreads (建立 pages 唯一 Source of Truth)
  let pages: PageModel[] = [];
  let spreads: SpreadModel[] = [];

  if (Array.isArray(data.pages) && data.pages.length > 0) {
    // 优先读取新格式 pages 数组
    pages = data.pages.map((p: any, pIdx: number) => normalizePage(p, pIdx, productSpec));
  } else if (Array.isArray(data.spreads) && data.spreads.length > 0) {
    // 降级从老版本 spreads 数组解构出扁平化 pages
    data.spreads.forEach((spread: any, sIdx: number) => {
      if (spread.leftPage) {
        pages.push(normalizePage(spread.leftPage, sIdx * 2, productSpec, 'inside_left', true));
      }
      if (spread.rightPage) {
        pages.push(normalizePage(spread.rightPage, sIdx * 2 + 1, productSpec, 'inside_right', false));
      }
    });
  }

  // 根据 pages 构建视图层 spreads 兼容镜像
  if (Array.isArray(data.spreads) && data.spreads.length > 0) {
    spreads = data.spreads.map((spread: any, sIdx: number) => ({
      id: spread.id || `spread_${sIdx}`,
      spreadIndex: typeof spread.spreadIndex === 'number' ? spread.spreadIndex : sIdx,
      type: spread.type || 'spread',
      name: spread.name,
      isCover: spread.isCover,
      leftPage: normalizePage(spread.leftPage || {}, sIdx * 2, productSpec, 'inside_left', true),
      rightPage: normalizePage(spread.rightPage || {}, sIdx * 2 + 1, productSpec, 'inside_right', false),
    }));
  } else {
    // 若仅有 pages，则按成对规则派生 spreads
    for (let i = 0; i < pages.length; i += 2) {
      const leftPage = pages[i] || normalizePage({}, i, productSpec, 'inside_left', true);
      const rightPage = pages[i + 1] || normalizePage({}, i + 1, productSpec, 'inside_right', false);
      const sIdx = Math.floor(i / 2);
      spreads.push({
        id: `spread_${sIdx}`,
        spreadIndex: sIdx,
        type: sIdx === 0 ? 'cover' : 'spread',
        isCover: sIdx === 0,
        leftPage,
        rightPage,
      });
    }
  }

  // 4. 规范化照片资产库 (保持 assetId 映射)
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
        isSystemStamp: p.isSystemStamp,
      }))
    : [];

  // 5. 规范化设计素材引用清单 (designAssets)
  const designAssets = Array.isArray(data.designAssets) ? data.designAssets : [];

  // 6. 规范化产品规格快照 (ProductSpecSnapshot)
  const productSpecSnapshot: ProductSpecSnapshot = data.productSpecSnapshot || {
    snapshotId: `spec_snap_${productSpec.id}_v${productSpec.version}`,
    productSpecId: productSpec.id,
    version: productSpec.version,
    frozenAt: createdAt,
    spec: JSON.parse(JSON.stringify(productSpec)),
  };

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: projectId,
    title,
    productSpec,
    productSpecSnapshot,
    pages,
    spreads,
    photos,
    designAssets,
    createdAt,
    updatedAt,
  };
}

/**
 * 规范化单个页面模型
 */
export function normalizePage(
  p: any,
  index: number,
  spec: ProductSpec,
  defaultFace: PageFaceType = 'inside_left',
  defaultIsLeft: boolean = true
): PageModel {
  const isLeft = p.isLeft !== undefined ? Boolean(p.isLeft) : defaultIsLeft;
  const faceType: PageFaceType = p.faceType || (index === 0 ? 'cover_front' : (isLeft ? 'inside_left' : 'inside_right'));
  const widthMm = spec.pageSpec?.widthMm || spec.widthMm || 200;
  const heightMm = spec.pageSpec?.heightMm || spec.heightMm || 200;

  const rawSlots = Array.isArray(p.slots) ? p.slots : (Array.isArray(p.elements) ? p.elements : []);
  const normalizedSlots = rawSlots.map((s: any) => normalizeSlot(s, widthMm, heightMm));

  return {
    id: p.id || `page_${index}_${Math.random().toString(36).substring(2, 6)}`,
    pageNumber: typeof p.pageNumber === 'number' ? p.pageNumber : index,
    faceType,
    isLeft,
    backgroundColor: p.backgroundColor || '#ffffff',
    backgroundImage: p.backgroundImage,
    backgroundAssetId: p.backgroundAssetId,
    backgroundScaleMode: p.backgroundScaleMode || 'cover',
    backgroundOpacity: p.backgroundOpacity,
    slots: normalizedSlots,
    elements: normalizedSlots,
    name: p.name,
    locked: Boolean(p.locked),
    customData: p.customData,
  };
}

/**
 * 规范化单个元素模型 (毫米与百分比双向校准)
 */
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
    fitMode: slot.fitMode || 'cover',
    flipH: Boolean(slot.flipH),
    flipV: Boolean(slot.flipV),
    maskShape: slot.maskShape,
    borderWidth: slot.borderWidth,
    borderColor: slot.borderColor,
    borderRadius: slot.borderRadius,
    hasShadow: Boolean(slot.hasShadow),
    shadowBlur: slot.shadowBlur,
    shadowColor: slot.shadowColor,
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

  // 冻结快照信息
  const productSpecSnapshot: ProductSpecSnapshot = project.productSpecSnapshot || {
    snapshotId: `spec_snap_${frozenSpec.id}_v${frozenSpec.version || 1}`,
    productSpecId: frozenSpec.id,
    version: frozenSpec.version || 1,
    frozenAt: Date.now(),
    spec: frozenSpec,
  };

  // 统计印刷实际页数与有效图片资产列表
  const totalPages = frozenProject.pages ? frozenProject.pages.length : frozenProject.spreads.length * 2;
  const referencedAssetIds = new Set<string>();

  if (frozenProject.pages) {
    frozenProject.pages.forEach((p) => {
      p.slots.forEach((slot) => {
        if (slot.assetId) referencedAssetIds.add(slot.assetId);
      });
    });
  } else {
    frozenProject.spreads.forEach((s) => {
      s.leftPage.slots.forEach((slot) => {
        if (slot.assetId) referencedAssetIds.add(slot.assetId);
      });
      s.rightPage.slots.forEach((slot) => {
        if (slot.assetId) referencedAssetIds.add(slot.assetId);
      });
    });
  }

  const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return {
    snapshotId,
    snapshotVersion: CURRENT_SCHEMA_VERSION,
    createdAt: Date.now(),
    frozenProject,
    productSpec: frozenSpec,
    productSpecSnapshot,
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
      totalPhysicalWidthMm: (frozenSpec.pageSpec?.widthMm || frozenSpec.widthMm) * 2 + (frozenSpec.binding?.spineWidthMm || 0),
      totalPhysicalHeightMm: frozenSpec.pageSpec?.heightMm || frozenSpec.heightMm,
      bleedMm: frozenSpec.pageSpec?.bleedMm ?? frozenSpec.bleedMm,
    },
  };
}
