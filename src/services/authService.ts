import { UserAccount, AuthProvider } from '../types/account';

const LOCAL_STORAGE_USER_KEY = 'momo_current_user';

// 预设本地虚拟用户列表 (供开发调试与代理商场景测试)
export const MOCK_LOCAL_USERS: UserAccount[] = [
  {
    id: 'user_agent_001',
    name: '米莫影像代理商·上海店',
    email: 'agent.shanghai@momo-print.com',
    companyName: '上海米莫文化创意有限公司',
    role: 'agent',
    status: 'active',
    tierId: 'tier_agent_gold',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user_designer_002',
    name: '首席排版设计师·李工',
    email: 'designer.lee@momo-print.com',
    role: 'designer',
    status: 'active',
    tierId: 'tier_vip',
    createdAt: '2025-03-15T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'user_consumer_003',
    name: '个人定制用户·张小悦',
    email: 'zhang.xiaoyue@example.com',
    role: 'user',
    status: 'active',
    tierId: 'tier_standard',
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
];

/**
 * 本地认证提供者实现 (LocalAuthProvider)
 * 仅用于无后端环境开发测试，数据存储在 localStorage 中
 */
export class LocalAuthProvider implements AuthProvider {
  private currentUser: UserAccount;

  constructor() {
    this.currentUser = this.loadInitialUser();
  }

  private loadInitialUser(): UserAccount {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    // 默认以代理商身份启动
    return MOCK_LOCAL_USERS[0];
  }

  async getCurrentUser(): Promise<UserAccount | null> {
    return { ...this.currentUser };
  }

  async switchUser(userId: string): Promise<UserAccount> {
    const target = MOCK_LOCAL_USERS.find((u) => u.id === userId) || {
      id: userId,
      name: `用户_${userId}`,
      role: 'agent',
      status: 'active',
      tierId: 'tier_agent_silver',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.currentUser = target;
    try {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(target));
    } catch {
      // ignore
    }
    return { ...this.currentUser };
  }

  async login(credentials: unknown): Promise<UserAccount> {
    const cred = credentials as { userId?: string };
    if (cred?.userId) {
      return this.switchUser(cred.userId);
    }
    return this.currentUser;
  }

  async logout(): Promise<void> {
    this.currentUser = MOCK_LOCAL_USERS[2]; // 降级为普通用户
    try {
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    } catch {
      // ignore
    }
  }
}

// 导出统一服务实例 (业务代码仅依赖 AuthProvider 接口)
export const authService: AuthProvider = new LocalAuthProvider();
