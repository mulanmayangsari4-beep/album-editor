import { ProductSpec } from './editor';
import { UserRole } from './account';

/**
 * 价格计算上下文 (支持代理商折扣、会员等级阶梯)
 */
export interface PricingContext {
  userId?: string;
  role?: UserRole;
  priceTier?: string; // 如 'tier_standard' | 'tier_agent_gold' | 'tier_vip'
}

/**
 * 价格计算输入参数 (PriceCalculationInput)
 */
export interface PriceCalculationInput {
  productSpec: ProductSpec;

  pageCount: number;

  quantity: number;

  extraOptions?: {
    coverMaterial?: string;      // 封面材质工艺升级
    paperType?: string;          // 纸张工艺升级
    packagingBox?: string;       // 精品礼盒
    giftBag?: boolean;           // 手提袋
    filmLamination?: string;     // 覆膜工艺 (亮膜/哑膜/触感膜)
    [key: string]: unknown;
  };

  context?: PricingContext;
}

/**
 * 费用明细清单 (PriceBreakdown)
 */
export interface PriceBreakdown {
  basePrice: number;             // 商品起步基础价 (包含基础页数)

  pagePrice: number;             // 加页/超页产生的费用

  extraOptionsPrice: number;     // 封面材质/纸张/包装等选配增项费用

  quantity: number;              // 印刷订购数量

  unitPrice: number;             // 单册原价 (折前)

  discountAmount: number;        // 会员/代理商专属优惠折扣金额

  subtotal: number;              // 小计 (单册实付价)

  total: number;                 // 总计 (subtotal * quantity)

  currency: string;              // 货币单位 (默认 'CNY' / '￥')

  tierDescription?: string;      // 计费阶梯说明 (如 "金牌代理商 7.5 折专属结算价")
}

/**
 * 价格计算服务接口 (PricingService)
 * 纯计算接口，不包含支付系统
 */
export interface PricingService {
  /**
   * 精确计算产品价格明细
   */
  calculatePrice(input: PriceCalculationInput): PriceBreakdown;

  /**
   * 格式化价格文本 (如 "￥168.00")
   */
  formatPrice(amount: number, currency?: string): string;
}
