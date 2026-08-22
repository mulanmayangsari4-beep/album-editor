/**
 * 核心数据架构定义 (TypeScript Types & Data Models)
 * 采用严谨的分层架构、物理毫米 Source of Truth、assetId 资产映射与 SchemaVersion 机制
 */

import { PhotoAnalysisResult } from './aiVision';

export * from './aiVision';

export const CURRENT_SCHEMA_VERSION = 2;

/**
 * 支持的商品类型体系 (全面覆盖照片印刷产品族)
 */
export type ProductType =
  | 'photobook'       // 相册 (Photobook)
  | 'album'           // 高端典藏相册 (Album)
  | 'desk_calendar'   // 桌面台历 (Desk Calendar)
  | 'calendar'        // 兼容别名
  | 'wall_calendar'   // 挂历 (Wall Calendar)
  | 'postcard'        // 明信片 (Postcard)
  | 'photo_frame'     // 照片摆台 (Photo Frame)
  | 'custom_print';   // 定制印品

/**
 * 元素图层类型
 */
export type ElementType = 'photo' | 'text' | 'stamp' | 'shape';

/**
 * 翻页/跨页排版形态
 */
export type LayoutMode = 'dual_spread' | 'single_page' | 'front_back';

/**
 * 单页在产品中的物理面类型 (Page Face Type)
 */
export type PageFaceType =
  | 'cover_front'    // 封底/封面：封一 (Front Cover)
  | 'cover_back'     // 封底/封面：封四 (Back Cover)
  | 'cover_spine'    // 书脊 (Spine)
  | 'inside_left'    // 内页左页
  | 'inside_right'   // 内页右页
  | 'single'         // 独立单页 (台历/挂历/单面摆台)
  | 'front'          // 正面 (明信片)
  | 'back';          // 反面 (明信片)

// ==========================================
// 1. 物理工艺规格子模型 (Decoupled Specs)
// ==========================================

/**
 * 内页物理规格 (Page Specification)
 * 物理毫米 (mm) 作为唯一 Source of Truth
 */
export interface PageSpec {
  widthMm: number;                // 净尺寸宽（毫米 mm）
  heightMm: number;               // 净尺寸高（毫米 mm）
  bleedMm: number;                // 出血尺寸（毫米 mm，通常 3mm）
  safeMarginMm: number;           // 四周裁切安全线（毫米 mm）
  innerGutterSafeMarginMm?: number;// 订口/中缝特殊避让安全区（毫米 mm）
}

/**
 * 书脊计算规则 (可扩展 Spine Rule)
 * 避免过度绑定硬编码公式，支持 fixed、manual 与 future_dynamic
 */
export type SpineRuleType = 'none' | 'fixed' | 'manual' | 'future_dynamic';

export interface SpineRule {
  type: SpineRuleType;
  fixedWidthMm?: number;          // 当 type === 'fixed' 或 'manual' 时的指定毫米数
  dynamicFormulaId?: string;      // 动态计算策略标识（如 "formula_copper_200gsm"）
  minWidthMm?: number;            // 最小书脊宽度保底 (mm)
  maxWidthMm?: number;            // 最大书脊宽度限制 (mm)
}

/**
 * 封面材质类型
 */
export type CoverMaterialType =
  | 'photo_paper'     // 铜版纸覆膜（全彩照片印刷封面，支持完整设计）
  | 'leatherette'     // 仿真皮/真皮（固定材料，通常不可自由排版）
  | 'linen'           // 棉麻/布艺（固定材料）
  | 'hardcover_board' // 灰板裱铜版纸（经典精装硬壳，带包边外扩）
  | 'softcover_card'  // 厚卡纸（软精装/骑马钉封面）
  | 'acrylic'         // 水晶/亚克力
  | 'wooden';         // 实木

/**
 * 封面独立规格模型 (Cover Specification)
 * 封面尺寸由产品配置完全管理，不进行自动强制换算
 */
export interface CoverSpec {
  materialType: CoverMaterialType; // 材质类型
  designable: boolean;             // 是否支持用户在编辑器中自由排版设计
  widthMm: number;                 // 封面单面/展开宽度（毫米 mm）
  heightMm: number;                // 封面高度（毫米 mm）
  bleedMm: number;                 // 封面专属出血（精装包边通常 15~20mm，软精装 3mm）
  wrapMarginMm?: number;           // 纸板折入/包边安全线（毫米 mm）
  safeMarginMm: number;            // 封面内容印刷安全距离（毫米 mm）
  spineRule: SpineRule;            // 解耦的书脊规则
  windowOpening?: {                // 预留封面开窗工艺（如皮面烫金开窗槽）
    enabled: boolean;
    shape: 'rectangle' | 'circle';
    widthMm: number;
    heightMm: number;
    xOffsetMm: number;
    yOffsetMm: number;
  };
}

/**
 * 装订工艺类型
 */
export type BindingType =
  | 'perfect_binding'   // 胶装 / 锁线胶装（有书脊，跨页中缝不可完全平摊）
  | 'hardcover_case'   // 精装（有纸板硬壳、沟槽、书背）
  | 'layflat'          // 蝴蝶对裱 / 跨页无缝平摊（180度平摊，中缝无缝）
  | 'saddle_stitch'    // 骑马钉（轻薄册子，无书脊）
  | 'wire_o'           // 双线圈 / 活页环装（台历、挂历，顶部/左侧打孔）
  | 'none';            // 无装订（明信片、摆台、散页）

/**
 * 装订工艺规范 (Binding Specification)
 * 只提供生产规则和安全避让提示，不直接强制修改封面尺寸
 */
export interface BindingSpec {
  bindingType: BindingType;        // 装订工艺类型
  name: string;                    // 工艺名称，如 "蝴蝶对裱精装" / "金属双线圈"
  bindingEdge: 'left' | 'top' | 'right'; // 装订边
  holePunchMarginMm?: number;      // 线圈打孔避让区（毫米 mm，如台历顶部 12mm）
  gutterHingeMm?: number;          // 精装夹缝压槽避让宽度（毫米 mm）
  isLayflat: boolean;              // 是否支持 180° 无缝平摊
  paperWeightGsm?: number;         // 默认内页纸张克重（如 200g 哑粉纸）
}

// 保持对 ProductBindingSpec 的兼容别名
export type ProductBindingSpec = {
  type: 'glue_layflat' | 'layflat_seamless' | 'saddle_stitch' | 'wire_o' | 'hardcover_case' | string;
  spineWidthMm?: number;
  gutterSafetyMm: number;
  bindingEdge?: 'left' | 'top' | 'right';
};

/**
 * 印刷导出规范 (Product Export Specification)
 */
export interface ProductExportSpec {
  dpi: number;                     // 印刷分辨率（工业标准 300）
  colorSpace: 'RGB' | 'CMYK';      // 色彩空间预留
  exportFormat: 'pdf' | 'zip_jpg' | 'single_jpg'; // 导出交付形态
  includeBleedInExport: boolean;   // 导出文件是否包含出血线外缘
  renderCropMarks: boolean;        // 是否在导出图像四角绘制印刷裁切线
}

/**
 * 产品功能能力矩阵 (Product Capabilities)
 * 控制不同产品品类的编辑器功能开关，与渲染组件完全解耦
 */
export interface ProductCapabilities {
  allowCoverDesign: boolean;       // 是否允许设计封面（照片封面=true，皮面/台历=false）
  allowText: boolean;              // 是否允许添加自定义文字
  allowSticker: boolean;           // 是否允许添加印章/贴纸/装饰
  allowAI: boolean;                // 是否允许启用 AI 视觉分析与智能排版
  allowMultiPhotoLayout: boolean;  // 是否允许多图混排（单张摆台=false，拼图/相册=true）
  allowPageAddDelete: boolean;     // 是否允许用户自由增减页（台历固定12/13张=false，相册=true）
  allowMaskShape: boolean;         // 是否允许照片使用异形蒙版形状
  allowBackgroundChange: boolean;  // 是否允许更换页面底纹背景
}

// ==========================================
// 2. ProductSpec 完整产品规格模型
// ==========================================

export interface ProductSpec {
  id: string;
  version: number;                 // 产品规格版本号（用于订单冻结和版本隔离）
  productType: ProductType;
  name: string;
  categoryName?: string;
  description?: string;
  sizeCategory?: string;           // 尺寸大类 (如 "8x8寸" / "A4" / "6寸")
  layoutMode: LayoutMode;          // 排版模式：dual_spread / single_page / front_back

  // 四大核心解耦子规格
  pageSpec: PageSpec;              // 内页物理规格 (Source of Truth)
  coverSpec?: CoverSpec;           // 封面独立物理规格
  bindingSpec?: BindingSpec;       // 装订生产规则
  exportSpec?: ProductExportSpec;  // 印刷导出规则
  capabilities: ProductCapabilities;// 产品能力矩阵

  // 生产工艺与页数规则
  defaultPages: number;            // 默认初始页数
  minPages: number;                // 最小允许页数
  maxPages: number;                // 最大允许页数
  pageStep?: number;               // 增减页步长 (例如折页必须按 2 或 4 页增减)
  canvasPixelSize?: number;        // 渲染层基准像素（前端视觉缩放参考）

  // 向下兼容旧字段别名 (将在运行时从 pageSpec/bindingSpec 智能镜像)
  widthMm: number;                 // 单页裁切成品宽度（毫米 mm）
  heightMm: number;                // 单页裁切成品高度（毫米 mm）
  bleedMm: number;                 // 出血位（毫米 mm）
  safeMarginMm: number;            // 页面四周通用安全边距（毫米 mm）
  binding?: ProductBindingSpec;    // 旧装订规范别名
  coverType?: 'hardcover' | 'softcover' | 'paper' | 'leather' | 'wooden' | string;

  // 台历/日程专用日期规则
  dateRules?: {
    year: number;
    startMonth: number;
    monthCount: number;
    showLunar?: boolean;
    showHolidays?: boolean;
  };

  allowedElementTypes?: ElementType[];
}

// 保持对旧名 BookSpec 的完全向前兼容别名
export type BookSpec = ProductSpec;

/**
 * 不可变产品规格快照 (ProductSpecSnapshot)
 * 订单必须冻结客户设计时的产品规格版本，不能直接引用未来修改后的 ProductSpec
 */
export interface ProductSpecSnapshot {
  snapshotId: string;
  productSpecId: string;
  version: number;                 // 冻结的产品版本号
  frozenAt: number;                // 冻结时间戳
  spec: ProductSpec;               // 完整的产品规格深拷贝数据
}

/**
 * 产品数据仓储抽象接口 (ProductRepository)
 * 编辑器不直接硬编码依赖本地静态数据，为未来对接后台 CMS/API 铺平道路
 */
export interface ProductRepository {
  getProductSpec(id: string): Promise<ProductSpec | null> | (ProductSpec | null);
  getAllProductSpecs(): Promise<ProductSpec[]> | ProductSpec[];
  getProductSpecsByCategory?(category: string): Promise<ProductSpec[]> | ProductSpec[];
}

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
 * 系统未来的唯一 Source of Truth 页面模型，支撑相册、台历、挂历、明信片、摆台等所有品类
 */
export interface PageModel {
  id: string;                     // 页面唯一 ID (如 page_01)
  pageNumber: number;             // 1-indexed 显示/生产物理页码 (0 代表封面/衬页)
  faceType?: PageFaceType;        // 物理面类型 (cover_front / inside_left / inside_right / single / front / back)
  isLeft: boolean;                // 是否为左页 (用于向后兼容现有布局与视觉镜像)
  
  // 物理与安全区域参数 (由 PageSpec 派生或单页独立重写)
  widthMm?: number;               // 页面独立物理宽 (可选，未指定则继承 productSpec.pageSpec)
  heightMm?: number;              // 页面独立物理高
  bleedMm?: number;               // 页面独立出血
  safeMarginMm?: number;          // 页面独立安全边距

  // 背景层配置
  backgroundColor: string;        // 背景纯色 (十六进制或 rgba)
  backgroundImage?: string;       // 背景图片 URL 或 AssetId
  backgroundAssetId?: string;     // 关联的背景素材 AssetId
  backgroundScaleMode?: 'cover' | 'contain' | 'tile'; // 背景平铺模式
  backgroundOpacity?: number;     // 背景不透明度

  // 页面图元列表 (按层级 zIndex 自下而上堆叠)
  slots: CanvasElement[];         // 页面内所有图层元素列表 (照片框、文本框、印章、形状)
  elements?: CanvasElement[];     // slots 的语义化别名，未来平滑演进

  // 页面业务元数据与标签
  name?: string;                  // 页面别名 (如 "1月", "封面", "结语")
  locked?: boolean;               // 页面是否锁定编辑
  customData?: Record<string, any>;// 扩展字段 (例如台历的年份月份数据、节日标注)
}

/**
 * 跨页数据模型 (Spread Model - 视图派生层 Layout View Model)
 * 注意：在未来架构中，SpreadModel 仅作为双跨页排版时的视图渲染容器，
 * 数据持久化及业务真值全部存储在 PageModel[] 中。
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
 * 设计素材引用模型 (Design Asset Reference)
 * 记录工程中引用的印章 (Stamp)、蒙版 (Mask)、背景 (Background)、装饰 (Decoration)、SVG
 * 确保 .album 工程包在跨电脑导入时能精确获知所有依赖素材
 */
export interface DesignAssetRef {
  assetId: string;                // 素材唯一 ID
  type: 'stamp' | 'mask' | 'background' | 'decoration' | 'svg';
  name: string;                   // 素材名称
  category?: string;              // 所属分类
  url?: string;                   // 素材资源路径或 Base64 缓存
  svgContent?: string;            // 内嵌 SVG 矢量数据
  version?: number;               // 素材版本
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
 * 
 * 核心架构规则：
 * 1. pages: PageModel[] 是跨产品族唯一的 Source of Truth 数据源。
 * 2. spreads: SpreadModel[] 保留作为双跨页排版形态时的只读/快速视图镜像。
 * 3. productSpecSnapshot: 冻结产品设计时刻的规格版本，隔离后续产品修改。
 * 4. designAssets: 记录工程中用到的所有图章、蒙版、背景等矢量设计素材。
 */
export interface ProjectDocument {
  schemaVersion: number;   // 数据模型版本号 (例如 2)
  id: string;              // 作品工程唯一 ID
  title: string;           // 作品名称
  productSpec: ProductSpec;// 绑定的商品物理规格
  productSpecSnapshot?: ProductSpecSnapshot; // 冻结的产品规格快照
  pages: PageModel[];      // 系统唯一 Source of Truth 页面列表
  spreads?: SpreadModel[]; // 双跨页兼容视图镜像
  photos: UploadedPhoto[]; // 作品关联的照片资产池 (仅保存 assetId 与元数据)
  designAssets?: DesignAssetRef[]; // 工程引用的素材资产清单
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
  productSpecSnapshot?: ProductSpecSnapshot; // 冻结规格快照
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
