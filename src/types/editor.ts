/**
 * 核心数据架构定义 (TypeScript Types & Data Models)
 * 采用严谨的分层架构、物理毫米 Source of Truth、assetId 资产映射与 SchemaVersion 机制
 */

import { PhotoAnalysisResult } from './aiVision';

export * from './aiVision';

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * 支持的商品类型体系 (可扩展扩展更多印刷物料)
 */
export type ProductType = 'photobook' | 'album' | 'calendar' | 'postcard' | 'custom_print';

/**
 * 元素图层类型
 */
export type ElementType = 'photo' | 'text' | 'stamp' | 'shape';

/**
 * 翻页/跨页布局形态
 */
export type LayoutMode = 'dual_spread' | 'single_page';

/**
 * 装订工艺形态与避让参数
 */
export interface ProductBindingSpec {
  type: 'glue_layflat' | 'layflat_seamless' | 'saddle_stitch' | 'wire_o' | 'hardcover_case';
  spineWidthMm?: number;      // 书脊厚度（毫米）
  gutterSafetyMm: number;     // 中缝/打孔装订安全避让区（毫米）
  bindingEdge?: 'left' | 'top' | 'right'; // 装订边（台历常为 top，相册常为 left）
}

/**
 * 商品工艺规格与生产规则模型 (Product Specification & Rules)
 * 商业化规则与编辑器核心逻辑彻底解耦
 */
export interface ProductSpec {
  id: string;
  productType: ProductType;
  name: string;
  categoryName?: string;
  description?: string;
  // 物理真值 (Source of Truth in Millimeters)
  widthMm: number;           // 单页裁切成品宽度（毫米 mm）
  heightMm: number;          // 单页裁切成品高度（毫米 mm）
  bleedMm: number;           // 出血位（毫米 mm，通常 3mm）
  safeMarginMm: number;      // 页面四周通用安全边距（毫米 mm）
  
  // 生产工艺限制规则
  defaultPages: number;      // 默认初始页数
  minPages: number;          // 最小允许页数
  maxPages: number;          // 最大允许页数
  pageStep?: number;         // 增减页步长 (例如折页必须按 2 或 4 页增减)
  canvasPixelSize: number;   // 渲染层基准像素（仅供前端视觉缩放参考，非持久化真值）
  
  layoutMode: LayoutMode;    // 双跨页(如相册) 或 单页正反面(如台历/明信片)
  binding?: ProductBindingSpec; // 装订规范
  
  // 台历/日程专用日期规则
  dateRules?: {
    year: number;
    startMonth: number;
    monthCount: number;
    showLunar?: boolean;
    showHolidays?: boolean;
  };

  allowedElementTypes?: ElementType[]; // 允许添加的图层类型
  coverType?: 'hardcover' | 'softcover' | 'paper' | 'leather';
}

// 保持对旧名 BookSpec 的完全向前兼容别名
export type BookSpec = ProductSpec;

/**
 * 照片无损裁剪变换数据模型
 */
export interface PhotoCrop {
  x: number;        // 内部原图相对位移 X 百分比 (0-100)
  y: number;        // 内部原图相对位移 Y 百分比 (0-100)
  scale: number;    // 内部原图缩放倍率 (>= 1.0)
  rotation: number; // 角度 (0, 90, 180, 270)
}

/**
 * 遮罩异形与排版样式形态
 */
export type MaskShape =
  | 'none'
  | 'circle'
  | 'heart'
  | 'star'
  | 'stamp'
  | 'diamond'
  | 'hexagon'
  | 'arch'
  | 'pill'
  | 'go'
  | 'tape'
  | 'saturn'
  | 'cat'
  | 'bear'
  | 'egg'
  | 'fish'
  | 'brush'
  | 'rounded_rect'
  | 'apple'
  | 'camera'
  | 'notebook'
  | 'flower'
  | 'flower_5'
  | 'bubble_left'
  | 'bubble_right'
  | 'bubble_rect'
  | 'triangle_down'
  | 'triangle_up'
  | 'grid_3x3'
  | 'banner_curve'
  | 'ticket'
  | 'corner_arc'
  | 'mickey'
  | 'blob_cloud'
  | 'pill_h'
  | 'oval_h'
  | 'arch_tall'
  | 'pill_right'
  | 'pill_left'
  | 'wave_left'
  | 'wave_right'
  | 'wave_both'
  | 'tilted_left'
  | 'tilted_right'
  | 'lace_crown'
  | 'lace_bottom'
  | string;
export type FitMode = 'cover' | 'contain';

/**
 * 统一画布元素数据模型 (CanvasElement / FrameSlot)
 * 
 * 坐标系定义说明：
 * 1. 物理真值 (Source of Truth in mm):
 *    通过结合所属 Page/ProductSpec 的 widthMm 和 heightMm，
 *    任何元素均具备精确的物理毫米坐标 (如 xMm, yMm, widthMm, heightMm)。
 * 2. 画布渲染与交互层 (0~100 百分比):
 *    x, y, width, height 在编辑器运行时使用页面版心百分比 (0-100)，
 *    以实现跨屏幕视口 (13寸笔记本/4K屏/移动端) 的自适应响应式无损渲染。
 */
export interface CanvasElement {
  id: string;
  type: ElementType;
  
  // 页面版心百分比坐标 (0-100)，与 page.widthMm / heightMm 严格按比例映射
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;       // 旋转角度 (0-360)
  
  // 显式物理毫米字段 (可选持久化/导出辅助，100% 对应真实成品毫米)
  xMm?: number;
  yMm?: number;
  widthMm?: number;
  heightMm?: number;
  
  // 商业级通用图层属性
  opacity?: number;        // 图层不透明度 (0.0 - 1.0，默认为 1)
  locked?: boolean;        // 是否锁定 (禁止移动/修改)
  visible?: boolean;       // 是否可见 (默认为 true)
  zIndex?: number;         // 图层堆叠层级

  // 造型、遮罩与装饰属性
  fitMode?: FitMode;       // 图片适应模式：'cover' (填充裁切) | 'contain' (适应完整不裁切)
  flipH?: boolean;         // 水平翻转 (镜像)
  flipV?: boolean;         // 垂直翻转
  maskShape?: MaskShape;   // 异形遮罩
  borderWidth?: number;    // 描边粗细 (px)
  borderColor?: string;    // 描边颜色
  borderRadius?: number;   // 倒圆角半径 (px)
  hasShadow?: boolean;     // 是否启用柔和相框阴影
  shadowBlur?: number;     // 阴影模糊度
  shadowColor?: string;    // 阴影颜色
  
  // 核心资产唯一身份引用 (解耦具体 CDN / 存储签名 URL)
  assetId?: string;        // 唯一图片资产 ID (如 asset_abc123)
  photoId?: string;        // 兼容现有代码的相册照片引用别名 (指向 assetId)
  
  crop?: PhotoCrop;        // 照片无损裁剪数据 (内部相对偏移与缩放倍率)
  
  // 文本专属字段
  placeholderText?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  
  // 智能构图排版辅助
  aspectRatioHint?: 'horizontal' | 'vertical' | 'square' | 'any';
  pixelLabel?: string;     // 视图层显示的像素预估标签 (如 2027x2027)
}

// 保持对 FrameSlot 的兼容别名
export type FrameSlot = CanvasElement;

/**
 * 单页数据模型 (Page Model)
 */
export interface PageModel {
  id: string;
  pageNumber: number;      // 1-indexed 页码
  isLeft: boolean;         // 是否为左页
  backgroundColor: string; // 背景纯色
  backgroundImage?: string;// 背景图片资产 URL 或 AssetId
  slots: CanvasElement[];  // 页面内所有图层元素列表
}

/**
 * 跨页数据模型 (Spread Model)
 */
export interface SpreadModel {
  id: string;
  spreadIndex: number;     // 0-indexed
  type?: 'spread' | 'cover' | 'spine' | 'backCover' | 'single';
  isCover?: boolean;
  leftPage: PageModel;
  rightPage: PageModel;
  name?: string;
}

/**
 * 照片上传与云端对象存储状态 (预留面向未来 OSS / COS / S3 / 本地离线)
 */
export type UploadStatus = 'local' | 'uploading' | 'uploaded' | 'failed';

/**
 * 照片资产分层变体 (用于缩略图、中等预览图与高清印刷原图分离架构)
 */
export interface PhotoAssetVariant {
  url: string;             // 访问地址 (本地 Data URL / Blob URL 或远端 CDN / 签名 URL)
  width?: number;          // 像素宽度
  height?: number;         // 像素高度
  fileSize?: number;       // 文件大小 (字节)
  storageKey?: string;     // 对象存储 Object Key
}

export interface PhotoAssetOriginal extends PhotoAssetVariant {
  file?: File;             // 客户端本地内存 File 对象 (不参与 JSON 序列化)
}

/**
 * 图片资产元数据结构 (Photo Asset Metadata)
 * 以 assetId 作为唯一身份标识，URL 仅为当前会话/预览时的网络载体
 * 架构核心准则：原图负责印刷质量，缩略图负责设计器速度，assetId 负责两者之间的身份关联。
 */
export interface PhotoAsset {
  id: string;              // 兼容现有相册代码的唯一 ID
  assetId?: string;        // 统一资产唯一 ID (与 id 保持一致，画框只引用该 ID)
  name: string;            // 原始文件名
  filename?: string;       // 文件名别名
  mimeType?: string;       // 图片 MIME 类型 (如 image/jpeg, image/png)
  
  // 核心视觉分层模型 (原图 vs 缩略图 vs 预览图)
  original?: PhotoAssetOriginal;
  preview?: PhotoAssetVariant;
  thumbnail?: PhotoAssetVariant;

  // 扁平化极速访问字段 (供设计器、画板和照片托盘高频访问)
  url: string;             // 默认显示 URL (中等预览图或本地快速图)
  thumbUrl: string;        // 缩略图 URL (兼容现有 thumbUrl)
  thumbnailUrl?: string;   // 轻量化缩略图 URL (最大 400px，用于照片池流畅瀑布流)
  previewUrl?: string;     // 中等预览图 URL (最大 1200px，用于画布 PhotoFrame 快速排版)
  originalUrl?: string;    // 高清原图 URL (用于印前 300 DPI 导出及高清放大镜)
  
  // 物理与几何属性
  naturalWidth: number;    // 原图原始物理像素宽 (用于印前 DPI 计算)
  naturalHeight: number;   // 原图原始物理像素高
  fileSize: number;        // 原图文件大小 (字节)
  usedCount: number;       // 当前作品中被引用的次数 (动态计算)
  aspectRatio: 'horizontal' | 'vertical' | 'square';
  createdAt: number;       // 上传时间戳
  captureTime?: number;    // EXIF 原始拍摄时间戳
  
  // 异步上传与存储架构预留 (默认 'local')
  uploadStatus?: UploadStatus; // 当前状态：'local' | 'uploading' | 'uploaded' | 'failed'
  storageKey?: string;     // 未来的云端对象存储 OSS / S3 / COS Object Key
  uploadProgress?: number; // 上传进度 0 ~ 100
  uploadError?: string;    // 错误信息

  // AI 视觉元数据
  aiAnalysis?: PhotoAnalysisResult; // 厂商中立的统一 AI 视觉分析元数据

  // 系统预置素材/图章标记 (用于与用户上传照片彻底解耦)
  isSystemStamp?: boolean;
}

// 保持对 UploadedPhoto 的别名，确保项目现有调用 100% 兼容
export type UploadedPhoto = PhotoAsset;

/**
 * 完整工程设计文档结构 (Project Document - 持久化与恢复的核心载体)
 */
export interface ProjectDocument {
  schemaVersion: number;   // 数据模型版本号 (例如 1)，支持未来平滑迁移
  id: string;              // 作品工程唯一 ID
  title: string;           // 作品名称
  productSpec: ProductSpec;// 绑定的商品物理规格
  spreads: SpreadModel[];  // 所有的跨页及元素完整排版数据
  photos: UploadedPhoto[]; // 作品关联的照片资产池
  createdAt: number;       // 创建时间戳
  updatedAt: number;       // 最后保存时间戳
}

/**
 * 不可变订单快照 (Immutable Order Snapshot)
 * 用户下单结账时生成，包含当时不可篡改的设计文档全量数据、计费选项与印刷规格
 */
export interface OrderSnapshot {
  snapshotId: string;           // 快照唯一 ID
  snapshotVersion: number;      // 快照版本
  createdAt: number;            // 下单时间
  frozenProject: ProjectDocument; // 冻结的完整工程设计数据 (深拷贝)
  productSpec: ProductSpec;     // 冻结的商品生产工艺规格
  quantity: number;             // 购买数量
  unitPrice: number;            // 单价
  currency: string;             // 货币符号 (CNY)
  selectedOptions?: {
    coverMaterial?: string;     // 封面材质 (如 精装硬壳覆哑膜)
    paperType?: string;         // 内页纸张 (如 200g 顶级超感哑粉纸)
    packaging?: string;         // 包装礼盒
  };
  printSummary: {
    pageCount: number;          // 印刷总页数
    totalPhotosUsed: number;    // 实际使用照片数
    totalPhysicalWidthMm: number; // 展开总物理宽度 (含书脊+出血)
    totalPhysicalHeightMm: number;// 总物理高度
    bleedMm: number;            // 出血位
  };
}

/**
 * 编辑器视图交互状态配置
 */
export interface EditorViewConfig {
  showBleed: boolean;    // 是否显示出血线
  showSafeZone: boolean; // 是否显示安全裁切线
  showGrid: boolean;     // 是否显示参考网格
  zoomPercent: number;   // 缩放百分比 (50-200)
}

/**
 * 间距吸附配置
 */
export interface SpacingConfig {
  enabled: boolean;
  gapMm: number;         // 固定间距物理毫米数 (如 2mm)
}

export interface FixedGapConfig {
  enabled: boolean;
  gapPercentX: number;
  gapPercentY: number;
  gapMm: number;
}

export type SidebarTab =
  | 'pages'
  | 'photos'
  | 'design'
  | 'layouts'
  | 'masks'
  | 'backgrounds'
  | 'elements'
  | 'themes'
  | 'import';

export interface CustomUserLayout {
  id: string;
  name: string;
  createdAt: number;
  slots: CanvasElement[];
  photoCount: number;
}
