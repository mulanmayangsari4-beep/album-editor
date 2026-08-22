import {
  ProductSpec,
  ProductRepository,
} from '../types/editor';

/**
 * 商业级多产品规格数据库 (Product Specifications Matrix)
 * 覆盖：相册 (Photobook)、高端皮面相册 (Album)、桌面台历 (Desk Calendar)、挂历 (Wall Calendar)、明信片 (Postcard)、照片摆台 (Photo Frame)
 * 
 * 核心架构准则：
 * 1. 物理毫米 (mm) 作为唯一 Source of Truth。
 * 2. 具备独立的 PageSpec、CoverSpec (SpineRule)、BindingSpec、ExportSpec 与 Capabilities 能力矩阵。
 * 3. 具备 version 版本号，用于未来订单生产冻结。
 */
export const PRODUCT_SPECS: Record<string, ProductSpec> = {
  // 1. 经典 8 寸方形对裱照片书 (8x8 Photobook)
  square_8inch_book: {
    id: 'square_8inch_book',
    version: 1,
    productType: 'photobook',
    name: '完美好翻书-方8寸',
    categoryName: '照片书',
    description: '经典轻便方本，进口超感哑粉纸，全景平摊软精装',
    sizeCategory: '8x8寸',
    layoutMode: 'dual_spread',
    
    // 独立内页物理规格
    pageSpec: {
      widthMm: 200,
      heightMm: 200,
      bleedMm: 3,
      safeMarginMm: 6,
      innerGutterSafeMarginMm: 5,
    },
    
    // 独立封面规格 (照片全彩印刷封面)
    coverSpec: {
      materialType: 'photo_paper',
      designable: true,
      widthMm: 200,
      heightMm: 200,
      bleedMm: 3,
      safeMarginMm: 6,
      spineRule: {
        type: 'fixed',
        fixedWidthMm: 5,
        minWidthMm: 3,
        maxWidthMm: 12,
      },
    },

    // 独立装订规则
    bindingSpec: {
      bindingType: 'layflat',
      name: '蝴蝶对裱平摊装订',
      bindingEdge: 'left',
      isLayflat: true,
      paperWeightGsm: 200,
    },

    // 印刷导出规范
    exportSpec: {
      dpi: 300,
      colorSpace: 'RGB',
      exportFormat: 'zip_jpg',
      includeBleedInExport: true,
      renderCropMarks: true,
    },

    // 产品能力矩阵
    capabilities: {
      allowCoverDesign: true,
      allowText: true,
      allowSticker: true,
      allowAI: true,
      allowMultiPhotoLayout: true,
      allowPageAddDelete: true,
      allowMaskShape: true,
      allowBackgroundChange: true,
    },

    // 工艺与页数规则
    defaultPages: 20,
    minPages: 16,
    maxPages: 80,
    pageStep: 2,
    canvasPixelSize: 2027,

    // 向下兼容镜像字段
    widthMm: 200,
    heightMm: 200,
    bleedMm: 3,
    safeMarginMm: 6,
    binding: {
      type: 'glue_layflat',
      spineWidthMm: 5,
      gutterSafetyMm: 5,
      bindingEdge: 'left',
    },
    allowedElementTypes: ['photo', 'text', 'stamp', 'shape'],
    coverType: 'softcover',
  },

  // 2. 经典 12 寸典藏精装大相册 (12x12 Large Album)
  large_12inch_album: {
    id: 'large_12inch_album',
    version: 1,
    productType: 'album',
    name: '典藏精装相册-12寸',
    categoryName: '高端相册',
    description: '一体成型无缝跨页，高克重卡纸覆膜，高档皮质/布艺硬壳',
    sizeCategory: '12x12寸',
    layoutMode: 'dual_spread',

    pageSpec: {
      widthMm: 280,
      heightMm: 280,
      bleedMm: 3,
      safeMarginMm: 8,
      innerGutterSafeMarginMm: 3,
    },

    coverSpec: {
      materialType: 'hardcover_board',
      designable: true,
      widthMm: 286, // 精装硬壳外扩 6mm
      heightMm: 286,
      bleedMm: 15,  // 经典包边 15mm 出血
      wrapMarginMm: 15,
      safeMarginMm: 10,
      spineRule: {
        type: 'fixed',
        fixedWidthMm: 12,
        minWidthMm: 8,
        maxWidthMm: 20,
      },
    },

    bindingSpec: {
      bindingType: 'hardcover_case',
      name: '工业级精装包边',
      bindingEdge: 'left',
      gutterHingeMm: 8,
      isLayflat: true,
      paperWeightGsm: 250,
    },

    exportSpec: {
      dpi: 300,
      colorSpace: 'RGB',
      exportFormat: 'pdf',
      includeBleedInExport: true,
      renderCropMarks: true,
    },

    capabilities: {
      allowCoverDesign: true,
      allowText: true,
      allowSticker: true,
      allowAI: true,
      allowMultiPhotoLayout: true,
      allowPageAddDelete: true,
      allowMaskShape: true,
      allowBackgroundChange: true,
    },

    defaultPages: 24,
    minPages: 20,
    maxPages: 60,
    pageStep: 2,
    canvasPixelSize: 2500,

    widthMm: 280,
    heightMm: 280,
    bleedMm: 3,
    safeMarginMm: 8,
    binding: {
      type: 'layflat_seamless',
      spineWidthMm: 12,
      gutterSafetyMm: 3,
      bindingEdge: 'left',
    },
    allowedElementTypes: ['photo', 'text', 'stamp', 'shape'],
    coverType: 'hardcover',
  },

  // 3. 横版桌面台历 (Landscape Desk Calendar)
  landscape_desk_calendar: {
    id: 'landscape_desk_calendar',
    version: 1,
    productType: 'desk_calendar',
    name: '时光桌面台历-横版',
    categoryName: '台历挂历',
    description: '双面印刷 13张/26页，双线圈打孔装订，特种细格纸',
    sizeCategory: '8寸横版',
    layoutMode: 'single_page',

    pageSpec: {
      widthMm: 210,
      heightMm: 140,
      bleedMm: 3,
      safeMarginMm: 8,
      innerGutterSafeMarginMm: 12, // 顶部 12mm 避让打孔
    },

    // 台历无独立外壳设计，采用整体统一内页流
    coverSpec: {
      materialType: 'photo_paper',
      designable: false,
      widthMm: 210,
      heightMm: 140,
      bleedMm: 3,
      safeMarginMm: 8,
      spineRule: { type: 'none' },
    },

    bindingSpec: {
      bindingType: 'wire_o',
      name: '双金属线圈装订',
      bindingEdge: 'top',
      holePunchMarginMm: 12,
      isLayflat: true,
      paperWeightGsm: 250,
    },

    exportSpec: {
      dpi: 300,
      colorSpace: 'RGB',
      exportFormat: 'zip_jpg',
      includeBleedInExport: true,
      renderCropMarks: false,
    },

    capabilities: {
      allowCoverDesign: false,
      allowText: true,
      allowSticker: true,
      allowAI: true,
      allowMultiPhotoLayout: true,
      allowPageAddDelete: false, // 固定 13 张/26 页不可随意增减
      allowMaskShape: true,
      allowBackgroundChange: true,
    },

    defaultPages: 26,
    minPages: 26,
    maxPages: 26,
    pageStep: 2,
    canvasPixelSize: 1800,

    widthMm: 210,
    heightMm: 140,
    bleedMm: 3,
    safeMarginMm: 8,
    binding: {
      type: 'wire_o',
      bindingEdge: 'top',
      gutterSafetyMm: 12,
    },
    dateRules: {
      year: 2026,
      startMonth: 1,
      monthCount: 12,
      showLunar: true,
      showHolidays: true,
    },
    allowedElementTypes: ['photo', 'text', 'stamp'],
    coverType: 'paper',
  },

  // 4. 精美艺术明信片套装 (Postcards - Front & Back)
  art_postcard_set: {
    id: 'art_postcard_set',
    version: 1,
    productType: 'postcard',
    name: '旅行艺术明信片-标准盒装',
    categoryName: '明信片卡片',
    description: '350g 超厚棉白卡纸，正反双面设计，标准邮政书写背栏',
    sizeCategory: '6寸标准',
    layoutMode: 'front_back',

    pageSpec: {
      widthMm: 148,
      heightMm: 100,
      bleedMm: 2,
      safeMarginMm: 4,
    },

    bindingSpec: {
      bindingType: 'none',
      name: '散装盒装',
      bindingEdge: 'left',
      isLayflat: true,
      paperWeightGsm: 350,
    },

    exportSpec: {
      dpi: 300,
      colorSpace: 'RGB',
      exportFormat: 'zip_jpg',
      includeBleedInExport: true,
      renderCropMarks: true,
    },

    capabilities: {
      allowCoverDesign: false,
      allowText: true,
      allowSticker: true,
      allowAI: true,
      allowMultiPhotoLayout: false, // 正面单张大图沉浸感
      allowPageAddDelete: true,
      allowMaskShape: false,
      allowBackgroundChange: true,
    },

    defaultPages: 16,
    minPages: 8,
    maxPages: 32,
    pageStep: 2,
    canvasPixelSize: 1500,

    widthMm: 148,
    heightMm: 100,
    bleedMm: 2,
    safeMarginMm: 4,
    binding: {
      type: 'saddle_stitch',
      bindingEdge: 'left',
      gutterSafetyMm: 2,
    },
    allowedElementTypes: ['photo', 'text', 'stamp'],
    coverType: 'paper',
  },

  // 5. 7寸 实木照片摆台 (Photo Frame)
  solid_wood_photo_frame: {
    id: 'solid_wood_photo_frame',
    version: 1,
    productType: 'photo_frame',
    name: '北欧实木摆台-7寸',
    categoryName: '照片摆台',
    description: '天然实木外框，微喷超清相纸，单张/九宫格/拼图摆台',
    sizeCategory: '7寸竖版',
    layoutMode: 'single_page',

    pageSpec: {
      widthMm: 127,
      heightMm: 178,
      bleedMm: 2,
      safeMarginMm: 5,
    },

    bindingSpec: {
      bindingType: 'none',
      name: '实木装裱',
      bindingEdge: 'left',
      isLayflat: true,
    },

    exportSpec: {
      dpi: 300,
      colorSpace: 'RGB',
      exportFormat: 'single_jpg',
      includeBleedInExport: true,
      renderCropMarks: false,
    },

    capabilities: {
      allowCoverDesign: false,
      allowText: true,
      allowSticker: true,
      allowAI: true,
      allowMultiPhotoLayout: true, // 支持单张、九宫格、自由拼图
      allowPageAddDelete: false,   // 摆台固定为单张成品
      allowMaskShape: true,
      allowBackgroundChange: true,
    },

    defaultPages: 1,
    minPages: 1,
    maxPages: 1,
    pageStep: 1,
    canvasPixelSize: 1600,

    widthMm: 127,
    heightMm: 178,
    bleedMm: 2,
    safeMarginMm: 5,
    binding: {
      type: 'none',
      bindingEdge: 'left',
      gutterSafetyMm: 0,
    },
    allowedElementTypes: ['photo', 'text', 'stamp', 'shape'],
    coverType: 'wooden',
  },
};

/**
 * 默认本地产品数据仓储实现 (LocalProductRepository)
 * 实现 ProductRepository 抽象接口，未来可无缝平替为云端 ApiProductRepository
 */
export class LocalProductRepository implements ProductRepository {
  private specs: Record<string, ProductSpec>;

  constructor(initialSpecs: Record<string, ProductSpec> = PRODUCT_SPECS) {
    this.specs = { ...initialSpecs };
  }

  getProductSpec(id: string): ProductSpec | null {
    return this.specs[id] || null;
  }

  getAllProductSpecs(): ProductSpec[] {
    return Object.values(this.specs);
  }

  getProductSpecsByCategory(category: string): ProductSpec[] {
    return Object.values(this.specs).filter(
      (s) => s.categoryName === category || s.productType === category
    );
  }
}

// 全局单例 Repository
export const defaultProductRepository = new LocalProductRepository();

/**
 * 校验当前商品页数是否符合工艺规则
 */
export function validateProductPageCount(
  spec: ProductSpec,
  currentPages: number
): { valid: boolean; reason?: string } {
  if (currentPages < spec.minPages) {
    return { valid: false, reason: `${spec.name} 最少需要 ${spec.minPages} 页` };
  }
  if (currentPages > spec.maxPages) {
    return { valid: false, reason: `${spec.name} 最多允许 ${spec.maxPages} 页` };
  }
  if (spec.pageStep && (currentPages - spec.minPages) % spec.pageStep !== 0) {
    return { valid: false, reason: `${spec.name} 页数增减必须为 ${spec.pageStep} 的倍数（印刷折页工艺要求）` };
  }
  return { valid: true };
}
