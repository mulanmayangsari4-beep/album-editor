export interface BookSpec {
  id: string;
  name: string;
  widthMm: number; // 单页宽度（毫米）
  heightMm: number; // 单页高度（毫米）
  bleedMm: number; // 出血位（毫米，通常 3mm）
  safeMarginMm: number; // 安全边距（毫米，通常 5mm）
  defaultPages: number;
  canvasPixelSize: number; // 画布像素基准（例如 2027px）
}

export interface PhotoCrop {
  x: number; // 偏移百分比 0-100 或 px
  y: number;
  scale: number; // 缩放倍率，最小 1.0 (cover)
  rotation: number; // 0, 90, 180, 270
}

export interface FrameSlot {
  id: string;
  type: 'photo' | 'text';
  x: number; // 在单页内的百分比位置 0-100
  y: number;
  width: number; // 百分比宽度 0-100
  height: number; // 百分比高度 0-100
  photoId?: string; // 关联的上传照片 ID
  crop?: PhotoCrop;
  placeholderText?: string;
  text?: string;
  fontSize?: number;
  aspectRatioHint?: 'horizontal' | 'vertical' | 'square' | 'any';
  pixelLabel?: string; // 界面上显示的像素尺寸标签如 767x1023
}

export interface PageModel {
  id: string;
  pageNumber: number; // 1-indexed
  isLeft: boolean; // 是否是左页
  backgroundColor: string;
  backgroundImage?: string;
  slots: FrameSlot[];
}

export interface SpreadModel {
  id: string;
  spreadIndex: number; // 0-indexed
  type?: 'spread' | 'cover' | 'spine' | 'backCover' | 'single';
  leftPage: PageModel;
  rightPage: PageModel;
  name?: string;
}

export interface UploadedPhoto {
  id: string;
  name: string;
  url: string; // Base64 或 Blob URL
  thumbUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  fileSize: number; // 字节
  usedCount: number; // 在当前画册中被引用的次数
  aspectRatio: 'horizontal' | 'vertical' | 'square';
  createdAt: number;
}

export interface EditorViewConfig {
  showBleed: boolean; // 是否显示 3mm 出血线 (粉红线)
  showSafeZone: boolean; // 是否显示安全裁切线
  showGrid: boolean; // 是否显示参考网格
  zoomPercent: number; // 缩放百分比 (50-200)
}

export interface SpacingConfig {
  enabled: boolean; // 是否启用固定间距吸附与保持 (用户可勾选自由移动)
  gapMm: number;    // 固定间距大小（毫米 mm，如 2mm）
}

export interface FixedGapConfig {
  enabled: boolean;
  gapPercentX: number;
  gapPercentY: number;
  gapMm: number;
}

export type SidebarTab =
  | 'photos'
  | 'design'
  | 'layouts'
  | 'backgrounds'
  | 'elements'
  | 'themes'
  | 'import';

export interface CustomUserLayout {
  id: string;
  name: string;
  createdAt: number;
  slots: FrameSlot[];
  photoCount: number;
}
