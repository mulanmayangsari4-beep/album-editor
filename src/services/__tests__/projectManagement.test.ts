import { UserAccount, AuthProvider } from '../../types/account';
import { LocalAuthProvider } from '../authService';
import { LocalProjectRepository } from '../../repositories/projectRepository';
import { ProjectService } from '../projectService';
import { LocalPricingService } from '../pricingService';
import { PRODUCT_SPECS } from '../../data/productSpecs';
import { ProjectDocument } from '../../types/editor';

// 简易测试运行器 (同项目内测试标准)
function describe(name: string, fn: () => void) {
  try {
    fn();
  } catch (err) {
    console.error(`Suite [${name}] failed:`, err);
    throw err;
  }
}

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      res.catch((err) => {
        console.error(`Async Test [${name}] failed:`, err);
        throw err;
      });
    }
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
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} > ${expected}`);
      }
    },
    toBeDefined() {
      if (actual === undefined || actual === null) {
        throw new Error(`Expected value to be defined but got ${actual}`);
      }
    },
  };
}

describe('商业化底座架构单元测试 (Auth + Project Management + Pricing)', () => {
  // 1. 用户认证抽象与多角色切换测试
  test('LocalAuthProvider 应正确返回默认代理商身份并支持切换', async () => {
    const auth = new LocalAuthProvider();
    const user = await auth.getCurrentUser();
    expect(user).toBeDefined();
    expect(user?.role).toBe('agent');

    // 切换到设计师身份
    const designer = await auth.switchUser('user_designer_002');
    expect(designer.role).toBe('designer');
  });

  // 2. 价格计算引擎解耦与角色阶梯折扣测试
  test('PricingService 应与 ProductSpec 解耦并正确计算基础价、超页价与代理商折扣', () => {
    const pricing = new LocalPricingService();
    const spec = PRODUCT_SPECS.square_8inch_book; // 包含 20 页，起步价 168

    // 测试 1：标准 20 页普通用户原价
    const retailBreakdown = pricing.calculatePrice({
      productSpec: spec,
      pageCount: 20,
      quantity: 1,
      context: { role: 'user', priceTier: 'tier_standard' },
    });
    expect(retailBreakdown.basePrice).toBe(168);
    expect(retailBreakdown.pagePrice).toBe(0);
    expect(retailBreakdown.total).toBe(168);

    // 测试 2：加页至 24 页 (超 4 页，每页 5 元 = +20 元)，金牌代理商 7.5 折
    const agentBreakdown = pricing.calculatePrice({
      productSpec: spec,
      pageCount: 24,
      quantity: 1,
      context: { role: 'agent', priceTier: 'tier_agent_gold' },
    });
    // 原价: 168 + 20 = 188
    // 代理商 7.5 折: 188 * 0.75 = 141.00
    expect(agentBreakdown.unitPrice).toBe(188);
    expect(agentBreakdown.total).toBe(141);
    expect(agentBreakdown.currency).toBe('CNY');
  });

  // 3. 作品管理多作品生命周期与深拷贝隔离测试
  test('ProjectRepository 必须支持多作品创建、完全深拷贝隔离与安全删除', async () => {
    const repo = new LocalProjectRepository();
    const service = new ProjectService(repo);

    // 创建作品 A
    const summaryA = await service.createProject({
      name: '张小姐婚礼相册',
      productSpecId: 'square_8inch_book',
      clientName: '张小姐',
    });
    expect(summaryA.name).toBe('张小姐婚礼相册');
    expect(summaryA.pageCount).toBeGreaterThan(0);

    // 打开作品 A 并修改 pages 内容
    const docA = await service.openProject(summaryA.projectId);
    docA.pages[0].backgroundColor = '#FFEEDD';
    await service.saveProject(docA);

    // 复制作品 A 生成副本 B
    const summaryB = await service.duplicateProject(summaryA.projectId);
    expect(summaryB.name).toBe('张小姐婚礼相册 - 副本');
    expect(summaryB.projectId !== summaryA.projectId).toBe(true);

    // 打开副本 B，验证 pages 已完全深拷贝隔离
    const docB = await service.openProject(summaryB.projectId);
    expect(docB.pages[0].backgroundColor).toBe('#FFEEDD');

    // 修改副本 B 的 pages，不应影响作品 A
    docB.pages[0].backgroundColor = '#000000';
    await service.saveProject(docB);

    const reloadedDocA = await service.openProject(summaryA.projectId);
    expect(reloadedDocA.pages[0].backgroundColor).toBe('#FFEEDD'); // 原工程 A 保持不变

    // 删除作品 A，不应影响作品 B
    await service.deleteProject(summaryA.projectId);
    const reloadedDocB = await service.openProject(summaryB.projectId);
    expect(reloadedDocB.id).toBe(summaryB.projectId);
  });
});
