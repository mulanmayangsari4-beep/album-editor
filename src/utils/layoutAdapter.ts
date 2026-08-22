import {
  PageModel,
  ProductSpec,
  LayoutMode,
  CanvasElement,
} from '../types/editor';
import {
  PageRenderModel,
  SpreadRenderModel,
} from '../types/layoutAdapter';

/**
 * 排版视图适配器核心抽象接口
 * 纯逻辑转换，严禁内部维持状态或复制元素数据
 */
export interface ILayoutAdapter {
  /**
   * 将平铺的持久化真值 pages[] 纯函数转换为视图层所需的 SpreadRenderModel[]
   */
  adaptToRender(pages: PageModel[], spec: ProductSpec): SpreadRenderModel[];
}

/**
 * 辅助方法：将单个 PageModel 纯函数映射为 PageRenderModel
 */
function createPageRenderModel(
  page: PageModel,
  spec: ProductSpec,
  options: {
    pageLabel?: string;
    isLeft?: boolean;
    showSpineLine?: boolean;
    showGutterHoles?: boolean;
    isCover?: boolean;
  } = {}
): PageRenderModel {
  const isCover = Boolean(options.isCover || page.faceType === 'cover_front' || page.faceType === 'cover_back');
  
  // 尺寸计算：如果是封面且配置了独立 coverSpec，优先读取 coverSpec
  let widthMm = spec.pageSpec?.widthMm || spec.widthMm || 200;
  let heightMm = spec.pageSpec?.heightMm || spec.heightMm || 200;
  let bleedMm = spec.pageSpec?.bleedMm ?? spec.bleedMm ?? 3;
  let safeMarginMm = spec.pageSpec?.safeMarginMm ?? spec.safeMarginMm ?? 5;
  let gutterHingeMm = spec.pageSpec?.innerGutterSafeMarginMm;

  if (isCover && spec.coverSpec) {
    widthMm = spec.coverSpec.widthMm || widthMm;
    heightMm = spec.coverSpec.heightMm || heightMm;
    bleedMm = spec.coverSpec.bleedMm ?? bleedMm;
    safeMarginMm = spec.coverSpec.safeMarginMm ?? safeMarginMm;
    gutterHingeMm = undefined;
  }

  // 页面级别独立重写尺寸优先
  if (typeof page.widthMm === 'number') widthMm = page.widthMm;
  if (typeof page.heightMm === 'number') heightMm = page.heightMm;
  if (typeof page.bleedMm === 'number') bleedMm = page.bleedMm;
  if (typeof page.safeMarginMm === 'number') safeMarginMm = page.safeMarginMm;

  // 标签格式化
  let label = options.pageLabel;
  if (!label) {
    if (page.name) {
      label = page.name;
    } else if (page.pageNumber === 0 || isCover) {
      label = '封面';
    } else {
      label = `P${page.pageNumber}`;
    }
  }

  const isLeft = options.isLeft !== undefined ? options.isLeft : page.isLeft;

  // 图元严格只读引用，杜绝深拷贝破坏内存引用体系
  const rawElements: CanvasElement[] = (page.slots || page.elements || []) as CanvasElement[];

  return {
    id: `render_${page.id}`,
    sourcePageId: page.id,
    pageNumber: page.pageNumber,
    pageLabel: label,
    faceType: page.faceType,
    widthMm,
    heightMm,
    bleedMm,
    safeMarginMm,
    gutterHingeMm,
    backgroundColor: page.backgroundColor,
    backgroundImage: page.backgroundImage,
    elements: rawElements,
    isLeft,
    locked: Boolean(page.locked),
    showSpineLine: options.showSpineLine,
    showGutterHoles: options.showGutterHoles,
  };
}

/**
 * 辅助方法：从 ProductSpec 提取书脊宽度 (mm)
 */
function resolveSpineWidthMm(spec: ProductSpec, isCover: boolean): number | undefined {
  if (!isCover) return undefined;
  
  if (spec.coverSpec?.spineRule) {
    const rule = spec.coverSpec.spineRule;
    if (rule.type === 'fixed' || rule.type === 'manual') {
      return rule.fixedWidthMm ?? 5;
    }
    if (rule.type === 'none') {
      return 0;
    }
  }

  if (spec.binding?.spineWidthMm !== undefined) {
    return spec.binding.spineWidthMm;
  }

  return 5;
}

/**
 * 1. DualSpreadAdapter (相册/照片书 双跨页适配器)
 * 规则：每 2 个 PageModel 组合为一个 SpreadRenderModel
 * 第 0 个为封面 (unitIndex = 0, isCover = true)
 * 第 1..N 为对开跨页 (unitIndex = 1..N, isCover = false)
 */
export class DualSpreadAdapter implements ILayoutAdapter {
  adaptToRender(pages: PageModel[], spec: ProductSpec): SpreadRenderModel[] {
    const result: SpreadRenderModel[] = [];
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i += 2) {
      const unitIndex = Math.floor(i / 2);
      const isCover = unitIndex === 0;
      const rawLeft = pages[i];
      const rawRight = pages[i + 1];

      // 提取书脊参数
      const spineWidthMm = resolveSpineWidthMm(spec, isCover);

      // 左页构建
      const leftRender: PageRenderModel = rawLeft
        ? createPageRenderModel(rawLeft, spec, {
            pageLabel: isCover ? '封底' : `P${rawLeft.pageNumber}`,
            isLeft: true,
            showSpineLine: isCover && (spineWidthMm ?? 0) > 0,
            isCover,
          })
        : {
            id: `render_empty_left_${unitIndex}`,
            sourcePageId: `empty_left_${unitIndex}`,
            pageNumber: i,
            pageLabel: isCover ? '封底' : `P${i}`,
            faceType: isCover ? 'cover_back' : 'inside_left',
            widthMm: spec.pageSpec?.widthMm || spec.widthMm || 200,
            heightMm: spec.pageSpec?.heightMm || spec.heightMm || 200,
            bleedMm: spec.pageSpec?.bleedMm ?? 3,
            safeMarginMm: spec.pageSpec?.safeMarginMm ?? 5,
            elements: [],
            isLeft: true,
            locked: false,
          };

      // 右页构建
      const rightRender: PageRenderModel = rawRight
        ? createPageRenderModel(rawRight, spec, {
            pageLabel: isCover ? '封面' : `P${rawRight.pageNumber}`,
            isLeft: false,
            showSpineLine: isCover && (spineWidthMm ?? 0) > 0,
            isCover,
          })
        : {
            id: `render_empty_right_${unitIndex}`,
            sourcePageId: `empty_right_${unitIndex}`,
            pageNumber: i + 1,
            pageLabel: isCover ? '封面' : `P${i + 1}`,
            faceType: isCover ? 'cover_front' : 'inside_right',
            widthMm: spec.pageSpec?.widthMm || spec.widthMm || 200,
            heightMm: spec.pageSpec?.heightMm || spec.heightMm || 200,
            bleedMm: spec.pageSpec?.bleedMm ?? 3,
            safeMarginMm: spec.pageSpec?.safeMarginMm ?? 5,
            elements: [],
            isLeft: false,
            locked: false,
          };

      const title = isCover
        ? '封面 / 封底'
        : `第 ${leftRender.pageNumber} - ${rightRender.pageNumber} 页`;

      const totalWidthMm = leftRender.widthMm + rightRender.widthMm + (isCover ? (spineWidthMm || 0) : 0);
      const totalHeightMm = Math.max(leftRender.heightMm, rightRender.heightMm);

      result.push({
        id: `spread_${unitIndex}`,
        unitIndex,
        title,
        layoutMode: 'dual_spread',
        pages: [leftRender, rightRender],
        leftPage: leftRender,
        rightPage: rightRender,
        totalWidthMm,
        totalHeightMm,
        spineWidthMm,
        isCover,
      });
    }

    return result;
  }
}

/**
 * 2. SinglePageAdapter (单页流适配器 - 台历、挂历、照片摆台)
 * 规则：1 个 PageModel 独立生成 1 个 SpreadRenderModel
 * 兼容现有 SpreadCanvas：leftPage = 当前页面, rightPage = null
 */
export class SinglePageAdapter implements ILayoutAdapter {
  adaptToRender(pages: PageModel[], spec: ProductSpec): SpreadRenderModel[] {
    const result: SpreadRenderModel[] = [];
    const holePunchMarginMm = spec.bindingSpec?.holePunchMarginMm || spec.binding?.gutterSafetyMm;
    const showGutterHoles = Boolean(holePunchMarginMm && holePunchMarginMm > 0);

    pages.forEach((page, index) => {
      let pageLabel = page.name;
      if (!pageLabel) {
        if (spec.productType === 'desk_calendar' || spec.productType === 'calendar') {
          pageLabel = `${index + 1}月`;
        } else {
          pageLabel = `第 ${index + 1} 页`;
        }
      }

      const pageRender = createPageRenderModel(page, spec, {
        pageLabel,
        isLeft: true,
        showGutterHoles,
        isCover: false,
      });

      result.push({
        id: `single_unit_${index}`,
        unitIndex: index,
        title: pageLabel,
        layoutMode: 'single_page',
        pages: [pageRender],
        leftPage: pageRender,
        rightPage: null, // 单页流显式无右页
        totalWidthMm: pageRender.widthMm,
        totalHeightMm: pageRender.heightMm,
        spineWidthMm: 0,
        isCover: false,
      });
    });

    return result;
  }
}

/**
 * 3. FrontBackAdapter (正反面适配器 - 明信片、贺卡)
 * 规则：每 2 个 PageModel (正面 front + 反面 back) 组成 1 个 SpreadRenderModel
 */
export class FrontBackAdapter implements ILayoutAdapter {
  adaptToRender(pages: PageModel[], spec: ProductSpec): SpreadRenderModel[] {
    const result: SpreadRenderModel[] = [];
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i += 2) {
      const cardIndex = Math.floor(i / 2);
      const rawFront = pages[i];
      const rawBack = pages[i + 1];

      const frontRender = rawFront
        ? createPageRenderModel(rawFront, spec, {
            pageLabel: '正面 (Front)',
            isLeft: true,
            isCover: false,
          })
        : {
            id: `render_empty_front_${cardIndex}`,
            sourcePageId: `empty_front_${cardIndex}`,
            pageNumber: i + 1,
            pageLabel: '正面 (Front)',
            faceType: 'front' as const,
            widthMm: spec.pageSpec?.widthMm || spec.widthMm || 148,
            heightMm: spec.pageSpec?.heightMm || spec.heightMm || 100,
            bleedMm: spec.pageSpec?.bleedMm ?? 2,
            safeMarginMm: spec.pageSpec?.safeMarginMm ?? 4,
            elements: [],
            isLeft: true,
            locked: false,
          };

      const backRender = rawBack
        ? createPageRenderModel(rawBack, spec, {
            pageLabel: '反面 (Back)',
            isLeft: false,
            isCover: false,
          })
        : {
            id: `render_empty_back_${cardIndex}`,
            sourcePageId: `empty_back_${cardIndex}`,
            pageNumber: i + 2,
            pageLabel: '反面 (Back)',
            faceType: 'back' as const,
            widthMm: spec.pageSpec?.widthMm || spec.widthMm || 148,
            heightMm: spec.pageSpec?.heightMm || spec.heightMm || 100,
            bleedMm: spec.pageSpec?.bleedMm ?? 2,
            safeMarginMm: spec.pageSpec?.safeMarginMm ?? 4,
            elements: [],
            isLeft: false,
            locked: false,
          };

      const totalWidthMm = frontRender.widthMm + backRender.widthMm;
      const totalHeightMm = Math.max(frontRender.heightMm, backRender.heightMm);

      result.push({
        id: `card_unit_${cardIndex}`,
        unitIndex: cardIndex,
        title: `明信片 #${cardIndex + 1} (正反面)`,
        layoutMode: 'front_back',
        pages: [frontRender, backRender],
        leftPage: frontRender,
        rightPage: backRender,
        totalWidthMm,
        totalHeightMm,
        spineWidthMm: 0,
        isCover: false,
      });
    }

    return result;
  }
}

/**
 * 适配器工厂函数 (Factory)
 * 根据产品排版模式返回对应的纯逻辑 LayoutAdapter 实例
 */
export function createLayoutAdapter(mode: LayoutMode): ILayoutAdapter {
  switch (mode) {
    case 'single_page':
      return new SinglePageAdapter();
    case 'front_back':
      return new FrontBackAdapter();
    case 'dual_spread':
    default:
      return new DualSpreadAdapter();
  }
}

/**
 * =========================================================================
 * 纯函数更新助手 (Immutable Update Helpers for pages: PageModel[])
 * 保证所有 UI 事件通过 pageId / slotId 严格回写唯一真值 pages[]
 * =========================================================================
 */

/**
 * 精确不可变更新指定 pageId 下的单个 slot/element
 */
export function updateSlotInPages(
  pages: PageModel[],
  pageId: string,
  slotId: string,
  updater: (prevSlot: CanvasElement) => CanvasElement
): PageModel[] {
  let hasChanged = false;
  const nextPages = pages.map((page) => {
    if (page.id !== pageId) return page;

    const rawSlots = page.slots || page.elements || [];
    let slotFound = false;
    const nextSlots = rawSlots.map((slot) => {
      if (slot.id !== slotId) return slot;
      slotFound = true;
      const updated = updater(slot);
      if (updated !== slot) hasChanged = true;
      return updated;
    });

    if (!slotFound) return page;

    return {
      ...page,
      slots: nextSlots,
      elements: nextSlots,
    };
  });

  return hasChanged ? nextPages : pages;
}

/**
 * 精确不可变更新指定 pageId 下的所有 slots
 */
export function updateSlotsInPage(
  pages: PageModel[],
  pageId: string,
  updater: (prevSlots: CanvasElement[]) => CanvasElement[]
): PageModel[] {
  return pages.map((page) => {
    if (page.id !== pageId) return page;
    const rawSlots = page.slots || page.elements || [];
    const nextSlots = updater(rawSlots);
    return {
      ...page,
      slots: nextSlots,
      elements: nextSlots,
    };
  });
}

/**
 * 精确不可变更新指定 pageId 的页面级属性 (如背景、名称等)
 */
export function updatePageInPages(
  pages: PageModel[],
  pageId: string,
  updater: (prevPage: PageModel) => PageModel
): PageModel[] {
  return pages.map((page) => {
    if (page.id !== pageId) return page;
    const next = updater(page);
    return {
      ...next,
      slots: next.slots || next.elements || [],
      elements: next.slots || next.elements || [],
    };
  });
}

/**
 * 重新连续计算全书双跨页对应的 PageModel[] 页码体系与物理面类型 (0 封面, 1 扉页, 2-3, 4-5, ...)
 */
export function reindexPagesForSpreads(pages: PageModel[]): PageModel[] {
  let currentPageCounter = 0;
  const result: PageModel[] = [];

  for (let i = 0; i < pages.length; i += 2) {
    const unitIndex = Math.floor(i / 2);
    const rawLeft = pages[i];
    const rawRight = pages[i + 1];

    if (unitIndex === 0) {
      // 封面跨页：封底 (左) / 封面 (右)
      if (rawLeft) {
        result.push({
          ...rawLeft,
          pageNumber: 0,
          isLeft: true,
          faceType: 'cover_back',
          name: rawLeft.name || '封底',
          slots: rawLeft.slots || rawLeft.elements || [],
          elements: rawLeft.slots || rawLeft.elements || [],
        });
      }
      if (rawRight) {
        result.push({
          ...rawRight,
          pageNumber: 0,
          isLeft: false,
          faceType: 'cover_front',
          name: rawRight.name || '封面',
          slots: rawRight.slots || rawRight.elements || [],
          elements: rawRight.slots || rawRight.elements || [],
        });
      }
    } else if (unitIndex === 1) {
      // 扉页跨页：左侧空白衬纸 (0) / 右侧第 1 页 (1)
      currentPageCounter = 1;
      if (rawLeft) {
        result.push({
          ...rawLeft,
          pageNumber: 0,
          isLeft: true,
          faceType: 'inside_left',
          name: rawLeft.name || '扉页衬纸',
          slots: rawLeft.slots || rawLeft.elements || [],
          elements: rawLeft.slots || rawLeft.elements || [],
        });
      }
      if (rawRight) {
        result.push({
          ...rawRight,
          pageNumber: 1,
          isLeft: false,
          faceType: 'inside_right',
          name: rawRight.name || '第 1 页 (扉页)',
          slots: rawRight.slots || rawRight.elements || [],
          elements: rawRight.slots || rawRight.elements || [],
        });
      }
    } else {
      // 后续常规双跨页
      const leftPageNum = currentPageCounter + 1;
      const rightPageNum = currentPageCounter + 2;
      currentPageCounter += 2;

      if (rawLeft) {
        result.push({
          ...rawLeft,
          pageNumber: leftPageNum,
          isLeft: true,
          faceType: 'inside_left',
          name: `第 ${leftPageNum} 页`,
          slots: rawLeft.slots || rawLeft.elements || [],
          elements: rawLeft.slots || rawLeft.elements || [],
        });
      }
      if (rawRight) {
        result.push({
          ...rawRight,
          pageNumber: rightPageNum,
          isLeft: false,
          faceType: 'inside_right',
          name: `第 ${rightPageNum} 页`,
          slots: rawRight.slots || rawRight.elements || [],
          elements: rawRight.slots || rawRight.elements || [],
        });
      }
    }
  }

  return result;
}


