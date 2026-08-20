import { ProductType, ProductSpec } from '../types/editor';

/**
 * 商品规格定义库：覆盖 照片书、相册、台历、明信片 等不同商品形态
 * 编辑器核心只消费标准 ProductSpec，具体商品差异通过规格与规则定义解耦
 */
export const PRODUCT_SPECS: Record<string, ProductSpec> = {
  // 1. 经典 8 寸方形照片书
  square_8inch_book: {
    id: 'square_8inch_book',
    productType: 'photobook',
    name: '完美好翻书-方8寸',
    categoryName: '照片书',
    description: '经典轻便方本，进口哑粉纸，全景平摊软精装',
    widthMm: 200,
    heightMm: 200,
    bleedMm: 3,
    safeMarginMm: 6,
    defaultPages: 20,
    minPages: 16,
    maxPages: 80,
    pageStep: 2,
    canvasPixelSize: 2027,
    layoutMode: 'dual_spread',
    binding: {
      type: 'glue_layflat',
      spineWidthMm: 5,
      gutterSafetyMm: 5,
      bindingEdge: 'left',
    },
    allowedElementTypes: ['photo', 'text', 'stamp', 'shape'],
    coverType: 'softcover',
  },

  // 2. 经典 12 寸精装大画册 (Album)
  large_12inch_album: {
    id: 'large_12inch_album',
    productType: 'album',
    name: '典藏精装相册-12寸',
    categoryName: '高端相册',
    description: '一体成型无缝跨页，高克重卡纸覆膜，高档皮质/布艺硬壳',
    widthMm: 280,
    heightMm: 280,
    bleedMm: 3,
    safeMarginMm: 8,
    defaultPages: 24,
    minPages: 20,
    maxPages: 60,
    pageStep: 2,
    canvasPixelSize: 2500,
    layoutMode: 'dual_spread',
    binding: {
      type: 'layflat_seamless',
      spineWidthMm: 12,
      gutterSafetyMm: 3,
      bindingEdge: 'left',
    },
    allowedElementTypes: ['photo', 'text', 'stamp', 'shape'],
    coverType: 'hardcover',
  },

  // 3. 横版桌面台历 (Desk Calendar)
  landscape_desk_calendar: {
    id: 'landscape_desk_calendar',
    productType: 'calendar',
    name: '时光桌面台历-横版',
    categoryName: '台历挂历',
    description: '双面印刷 13张/26页，双线圈打孔装订，特种细格纸',
    widthMm: 210,
    heightMm: 140,
    bleedMm: 3,
    safeMarginMm: 8,
    defaultPages: 26,
    minPages: 26,
    maxPages: 26,
    pageStep: 2,
    canvasPixelSize: 1800,
    layoutMode: 'single_page',
    binding: {
      type: 'wire_o',
      bindingEdge: 'top',
      gutterSafetyMm: 12, // 顶部线圈孔 12mm 避让区
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

  // 4. 精美艺术明信片套装 (Postcards)
  art_postcard_set: {
    id: 'art_postcard_set',
    productType: 'postcard',
    name: '旅行艺术明信片-标准盒装',
    categoryName: '明信片卡片',
    description: '350g 超厚棉白卡纸，正反双面设计，标准邮政书写背栏',
    widthMm: 148,
    heightMm: 100,
    bleedMm: 2,
    safeMarginMm: 4,
    defaultPages: 16,
    minPages: 8,
    maxPages: 32,
    pageStep: 2,
    canvasPixelSize: 1500,
    layoutMode: 'single_page',
    binding: {
      type: 'saddle_stitch', // 无订散装
      bindingEdge: 'left',
      gutterSafetyMm: 2,
    },
    allowedElementTypes: ['photo', 'text', 'stamp'],
    coverType: 'paper',
  },
};

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
