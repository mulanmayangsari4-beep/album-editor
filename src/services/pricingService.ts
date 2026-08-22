import {
  PriceCalculationInput,
  PriceBreakdown,
  PricingService,
} from '../types/pricing';

/**
 * 解耦的商品品类基础价格策略表
 * 价格独立于 ProductSpec 本身，支持按规格 ID 独立配置
 */
interface ProductPriceRule {
  specId: string;
  basePrice: number;        // 起步价 (元)
  includedPages: number;    // 起步价包含的页数
  pricePerPage: number;     // 超出包含页数后，单页增页费 (元/页)
  minPageStep: number;      // 加页最小递增步长 (通常为 2 页一跨页)
}

const DEFAULT_PRICE_RULES: Record<string, ProductPriceRule> = {
  square_8inch_book: {
    specId: 'square_8inch_book',
    basePrice: 168,
    includedPages: 20,
    pricePerPage: 5,
    minPageStep: 2,
  },
  a4_landscape_book: {
    specId: 'a4_landscape_book',
    basePrice: 228,
    includedPages: 24,
    pricePerPage: 6,
    minPageStep: 2,
  },
  desk_calendar_vertical: {
    specId: 'desk_calendar_vertical',
    basePrice: 68,
    includedPages: 14,
    pricePerPage: 4,
    minPageStep: 2,
  },
  wall_calendar_a3: {
    specId: 'wall_calendar_a3',
    basePrice: 128,
    includedPages: 14,
    pricePerPage: 8,
    minPageStep: 2,
  },
  postcard_box: {
    specId: 'postcard_box',
    basePrice: 48,
    includedPages: 16,
    pricePerPage: 2,
    minPageStep: 2,
  },
  photo_frame_10inch: {
    specId: 'photo_frame_10inch',
    basePrice: 88,
    includedPages: 1,
    pricePerPage: 0,
    minPageStep: 1,
  },
};

/**
 * 选配工艺附加费表
 */
const EXTRA_OPTION_PRICES: Record<string, number> = {
  // 封面工艺
  cover_hardcover_cloth: 35,    // 布艺精装
  cover_leather: 60,            // 意式皮革封面
  cover_acrylic: 50,            // 水晶亚克力封面
  cover_wooden: 45,             // 原木典藏封面
  // 纸张工艺
  paper_art_matte_250g: 20,     // 250g 顶级超感艺术纸
  paper_silver_halide: 40,      // 富士晶彩银盐相纸
  // 包装
  packaging_gift_box: 30,       // 定制天地盖烫金礼盒
  packaging_wood_box: 68,       // 纯实木收纳礼盒
  // 覆膜
  film_soft_touch: 15,          // 婴儿肤感丝绒膜
};

/**
 * 角色/价格阶梯折扣系数
 */
const TIER_DISCOUNT_RATES: Record<string, { rate: number; label: string }> = {
  tier_agent_gold: { rate: 0.75, label: '金牌代理商专属 7.5 折结算' },
  tier_agent_silver: { rate: 0.85, label: '银牌代理商 8.5 折结算' },
  tier_vip: { rate: 0.70, label: 'VIP 设计师专属 7.0 折特惠' },
  tier_standard: { rate: 1.0, label: '标准零售价' },
};

/**
 * 本地价格计算服务 (LocalPricingService)
 * 纯数学与商业规则引擎，无任何支付 SDK 依赖
 */
export class LocalPricingService implements PricingService {
  calculatePrice(input: PriceCalculationInput): PriceBreakdown {
    const { productSpec, pageCount, quantity, extraOptions, context } = input;
    const safeQuantity = Math.max(1, quantity || 1);

    // 1. 查找或派生产品基础价格规则
    const rule = DEFAULT_PRICE_RULES[productSpec.id] || {
      specId: productSpec.id,
      basePrice: 120,
      includedPages: productSpec.minPages || 20,
      pricePerPage: 5,
      minPageStep: 2,
    };

    const basePrice = rule.basePrice;

    // 2. 计算超页费用
    const extraPages = Math.max(0, pageCount - rule.includedPages);
    const pagePrice = extraPages * rule.pricePerPage;

    // 3. 计算选配件/工艺加价
    let extraOptionsPrice = 0;
    if (extraOptions) {
      Object.entries(extraOptions).forEach(([key, val]) => {
        if (typeof val === 'string' && EXTRA_OPTION_PRICES[val]) {
          extraOptionsPrice += EXTRA_OPTION_PRICES[val];
        } else if (typeof val === 'boolean' && val && EXTRA_OPTION_PRICES[key]) {
          extraOptionsPrice += EXTRA_OPTION_PRICES[key];
        }
      });
    }

    // 单册标准原价
    const standardUnitPrice = basePrice + pagePrice + extraOptionsPrice;

    // 4. 计算代理商/会员折扣
    let discountRate = 1.0;
    let tierDescription = '标准零售价';

    if (context?.priceTier && TIER_DISCOUNT_RATES[context.priceTier]) {
      const tier = TIER_DISCOUNT_RATES[context.priceTier];
      discountRate = tier.rate;
      tierDescription = tier.label;
    } else if (context?.role === 'agent') {
      discountRate = 0.75;
      tierDescription = '代理商专属 7.5 折结算';
    } else if (context?.role === 'designer') {
      discountRate = 0.80;
      tierDescription = '签约设计师 8.0 折特惠';
    }

    const discountedUnitPrice = Number((standardUnitPrice * discountRate).toFixed(2));
    const discountAmount = Number(((standardUnitPrice - discountedUnitPrice) * safeQuantity).toFixed(2));
    const subtotal = discountedUnitPrice;
    const total = Number((subtotal * safeQuantity).toFixed(2));

    return {
      basePrice,
      pagePrice,
      extraOptionsPrice,
      quantity: safeQuantity,
      unitPrice: standardUnitPrice,
      discountAmount,
      subtotal,
      total,
      currency: 'CNY',
      tierDescription,
    };
  }

  formatPrice(amount: number, currency: string = 'CNY'): string {
    const symbol = currency === 'CNY' ? '￥' : '$';
    return `${symbol}${amount.toFixed(2)}`;
  }
}

// 导出统一价格计算服务单例
export const pricingService: PricingService = new LocalPricingService();
