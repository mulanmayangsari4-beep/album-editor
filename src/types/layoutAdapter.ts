import {
  PageFaceType,
  LayoutMode,
  CanvasElement,
} from './editor';

/**
 * 单页渲染模型 (PageRenderModel)
 * 作为视图层纯只读渲染数据，禁止作为业务状态源。
 * 内部 elements 严格只读引用 PageModel.slots，不进行深拷贝。
 */
export interface PageRenderModel {
  id: string;                      // 渲染节点唯一标识
  sourcePageId: string;            // 对应的持久化唯一真值 PageModel.id (用于反向寻址回写)
  pageNumber: number;              // 1-indexed 物理显示页码 (0 代表封面)
  pageLabel: string;               // 界面展示标签 (如 "封面", "P1", "1月", "正面")
  faceType: PageFaceType;          // cover_front / inside_left / inside_right / single / front / back

  // 物理与视口几何参数 (毫米 mm)
  widthMm: number;                 // 净宽 (mm)
  heightMm: number;                // 净高 (mm)
  bleedMm: number;                 // 出血位 (mm)
  safeMarginMm: number;            // 裁切安全线 (mm)
  gutterHingeMm?: number;          // 订口/夹缝/打孔避让区 (mm)

  // 背景层配置
  backgroundColor?: string;
  backgroundImage?: string;

  // 图元列表 (必须严格只读引用原始 PageModel 数据)
  elements: Readonly<CanvasElement[]>;

  // 视图控制标记
  isLeft: boolean;                 // 是否作为左半区展示
  locked: boolean;                 // 页面是否锁定

  // 辅助渲染线标记
  showSpineLine?: boolean;         // 是否在边缘绘制书脊折线
  showGutterHoles?: boolean;       // 是否渲染台历线圈孔辅助虚线
}

/**
 * 可视排版单元渲染模型 (SpreadRenderModel)
 * 用于向下兼容现有 SpreadCanvas 画布容器及缩略图导航。
 * 纯派生模型，不可持久化，不可保存状态。
 */
export interface SpreadRenderModel {
  id: string;                      // 渲染单元唯一 ID (如 spread_0, page_unit_1)
  unitIndex: number;               // 单元索引 (0-indexed)
  title: string;                   // 单元标题 (如 "封面", "P1-P2", "1月", "明信片 正反面")
  layoutMode: LayoutMode;          // dual_spread / single_page / front_back

  // 核心页面载荷 (1个或2个)
  pages: PageRenderModel[];

  // 兼容现有 SpreadCanvas 组件消费的视口插槽
  leftPage: PageRenderModel;
  rightPage?: PageRenderModel | null;

  // 物理跨页视口总尺寸 (毫米 mm)
  totalWidthMm: number;            // 视口总宽 (单页宽*2 + 书脊宽，或单页宽)
  totalHeightMm: number;           // 视口总高

  spineWidthMm?: number;           // 书脊厚度 (mm)
  isCover: boolean;                // 是否为封面
}

/**
 * 封面专用高级渲染模型 (CoverRenderModel)
 * 用于未来支持精装封皮外扩、皮面/布艺免排版、烫金、开窗等工艺
 */
export interface CoverRenderModel {
  frontPage: PageRenderModel;      // 封一面
  backPage: PageRenderModel;       // 封四面
  spineWidthMm?: number;           // 书脊宽度
  wrapMarginMm?: number;           // 包边折入线 (mm)
  isDesignable: boolean;           // 是否支持自定义设计排版
  materialType?: string;           // 材质类型
}
