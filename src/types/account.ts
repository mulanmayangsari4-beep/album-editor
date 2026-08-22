/**
 * 用户/会员体系抽象模型 (Account & Authentication Types)
 * 采用接口化设计，隔离业务层与底层认证实现 (Local / OAuth / SSO / REST API)
 */

export type UserRole = 'admin' | 'agent' | 'designer' | 'user';
export type AccountStatus = 'active' | 'disabled';

export interface UserAccount {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  phone?: string;
  companyName?: string; // 代理商/机构企业名称

  role: UserRole;
  status: AccountStatus;

  // 会员等级/价格阶梯标识 (预留多租户/代理商等级)
  tierId?: 'tier_standard' | 'tier_agent_silver' | 'tier_agent_gold' | 'tier_vip';

  createdAt: string;
  updatedAt: string;
}

/**
 * 认证服务抽象接口 (AuthProvider)
 * 当前阶段仅使用 LocalAuthProvider，未来可无缝替换为 ApiAuthProvider
 */
export interface AuthProvider {
  /**
   * 获取当前已登录的用户信息
   */
  getCurrentUser(): Promise<UserAccount | null>;

  /**
   * 登录接口 (预留)
   */
  login?(credentials: unknown): Promise<UserAccount>;

  /**
   * 登出接口 (预留)
   */
  logout?(): Promise<void>;

  /**
   * 切换当前模拟角色/用户 (用于本地开发与代理商快速调试)
   */
  switchUser?(userId: string): Promise<UserAccount>;
}
