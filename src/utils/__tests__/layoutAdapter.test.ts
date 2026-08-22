import { PageModel, ProductSpec } from '../../types/editor';
import { createLayoutAdapter, DualSpreadAdapter, SinglePageAdapter, FrontBackAdapter } from '../layoutAdapter';
import { PRODUCT_SPECS } from '../../data/productSpecs';

// 独立无依赖简易测试框架运行器
function describe(name: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.error(`Suite [${name}] failed:`, err);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.error(`Test [${name}] failed:`, err);
    throw err;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
      }
    },
    toBeInstanceOf(expectedClass: any) {
      if (!(actual instanceof expectedClass)) {
        throw new Error(`Expected instance of ${expectedClass.name}`);
      }
    },
  };
}

describe('LayoutAdapter Suite (纯逻辑排版适配层测试)', () => {
  // 辅助函数：创建测试用 PageModel 数组
  function createMockPages(count: number, prefix: string = 'p'): PageModel[] {
    return Array.from({ length: count }, (_, idx) => ({
      id: `${prefix}_${idx}`,
      pageNumber: idx,
      faceType: idx === 0 ? 'cover_front' : (idx % 2 === 0 ? 'inside_left' : 'inside_right'),
      isLeft: idx % 2 === 0,
      backgroundColor: '#ffffff',
      slots: [
        {
          id: `slot_${idx}_1`,
          type: 'photo',
          x: 10,
          y: 10,
          width: 80,
          height: 80,
          xMm: 20,
          yMm: 20,
          widthMm: 160,
          heightMm: 160,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          zIndex: 1,
          fitMode: 'cover',
          flipH: false,
          flipV: false,
        },
      ],
    }));
  }

  // 测试 1：24页相册 (dual_spread) -> 12 个 SpreadRenderModel
  test('测试1: 24页相册 (dual_spread) 转换为 12 个 SpreadRenderModel', () => {
    const spec: ProductSpec = PRODUCT_SPECS.square_8inch_book;
    const pages = createMockPages(24, 'photobook');
    
    const adapter = createLayoutAdapter('dual_spread');
    expect(adapter).toBeInstanceOf(DualSpreadAdapter);

    const spreads = adapter.adaptToRender(pages, spec);

    // 验证单元数量：24页 / 2 = 12 个 Spread
    expect(spreads.length).toBe(12);

    // 验证封面单元 (Spread 0)
    const coverSpread = spreads[0];
    expect(coverSpread.isCover).toBe(true);
    expect(coverSpread.unitIndex).toBe(0);
    expect(coverSpread.layoutMode).toBe('dual_spread');
    expect(coverSpread.leftPage.pageLabel).toBe('封底');
    expect(coverSpread.rightPage?.pageLabel).toBe('封面');
    expect(coverSpread.spineWidthMm).toBe(5);
    // 封面总宽 = 200 + 200 + 5 = 405 mm
    expect(coverSpread.totalWidthMm).toBe(405);

    // 验证内页单元 (Spread 1)
    const insideSpread = spreads[1];
    expect(insideSpread.isCover).toBe(false);
    expect(insideSpread.unitIndex).toBe(1);
    expect(insideSpread.leftPage.pageNumber).toBe(2);
    expect(insideSpread.rightPage?.pageNumber).toBe(3);

    // 验证元素严格只读引用，绝不进行有损或新的深拷贝
    expect(insideSpread.leftPage.elements).toBe(pages[2].slots);
  });

  // 测试 2：12页台历 (single_page) -> 12 个 SpreadRenderModel
  test('测试2: 12页台历 (single_page) 转换为 12 个 SpreadRenderModel', () => {
    const spec: ProductSpec = PRODUCT_SPECS.landscape_desk_calendar;
    const pages = createMockPages(12, 'calendar');

    const adapter = createLayoutAdapter('single_page');
    expect(adapter).toBeInstanceOf(SinglePageAdapter);

    const spreads = adapter.adaptToRender(pages, spec);

    // 验证单元数量：12页 = 12 个独立单页单元
    expect(spreads.length).toBe(12);

    // 验证单页单元属性
    const firstMonth = spreads[0];
    expect(firstMonth.layoutMode).toBe('single_page');
    expect(firstMonth.leftPage.pageLabel).toBe('1月');
    expect(firstMonth.rightPage).toBeNull(); // 显式单页无右页
    expect(firstMonth.totalWidthMm).toBe(210); // 台历单页宽 210mm
    expect(firstMonth.totalHeightMm).toBe(140);
    expect(firstMonth.leftPage.showGutterHoles).toBe(true); // 带有顶部打孔标记

    // 验证第 12 月
    const lastMonth = spreads[11];
    expect(lastMonth.leftPage.pageLabel).toBe('12月');
    expect(lastMonth.leftPage.elements).toBe(pages[11].slots);
  });

  // 测试 3：明信片 (front_back, 2 pages) -> 1 个 SpreadRenderModel
  test('测试3: 明信片 (front_back, 2 pages) 转换为 1 个 SpreadRenderModel', () => {
    const spec: ProductSpec = PRODUCT_SPECS.art_postcard_set;
    const pages = createMockPages(2, 'postcard');

    const adapter = createLayoutAdapter('front_back');
    expect(adapter).toBeInstanceOf(FrontBackAdapter);

    const spreads = adapter.adaptToRender(pages, spec);

    // 验证单元数量：2页 = 1 个正反面卡片单元
    expect(spreads.length).toBe(1);

    const cardSpread = spreads[0];
    expect(cardSpread.layoutMode).toBe('front_back');
    expect(cardSpread.unitIndex).toBe(0);
    expect(cardSpread.leftPage.pageLabel).toBe('正面 (Front)');
    expect(cardSpread.rightPage?.pageLabel).toBe('反面 (Back)');
    expect(cardSpread.totalWidthMm).toBe(148 + 148); // 正反两面展开 296mm
    expect(cardSpread.totalHeightMm).toBe(100);
    expect(cardSpread.spineWidthMm).toBe(0);

    // 验证元素直接引用
    expect(cardSpread.leftPage.elements).toBe(pages[0].slots);
    expect(cardSpread.rightPage?.elements).toBe(pages[1].slots);
  });
});
