import { ProjectDocument } from '../types/editor';
import { ProjectSummary, CreateProjectInput, ProjectFilterOptions } from '../types/project';
import { ProjectRepository, projectRepository } from '../repositories/projectRepository';
import { AuthProvider } from '../types/account';
import { authService } from './authService';

/**
 * 作品业务服务门面 (ProjectService)
 * 隔离 UI 组件与底层 Repository 存储实现
 * 统一处理用户鉴权上下文、作品生命周期与错误捕获
 */
export class ProjectService {
  constructor(
    private repository: ProjectRepository = projectRepository,
    private auth: AuthProvider = authService
  ) {}

  /**
   * 获取当前登录用户的作品列表
   */
  async listUserProjects(filter?: Omit<ProjectFilterOptions, 'ownerId'>): Promise<ProjectSummary[]> {
    const user = await this.auth.getCurrentUser();
    const ownerId = user?.id || 'user_agent_001';
    return this.repository.listProjects(ownerId, { ...filter, ownerId });
  }

  /**
   * 根据作品 ID 打开并获取完整设计文档
   */
  async openProject(projectId: string): Promise<ProjectDocument> {
    const doc = await this.repository.getProject(projectId);
    if (!doc) {
      throw new Error(`无法打开作品：未找到 ID 为 [${projectId}] 的工程`);
    }
    return doc;
  }

  /**
   * 创建全新作品
   */
  async createProject(input: Omit<CreateProjectInput, 'ownerId'>): Promise<ProjectSummary> {
    const user = await this.auth.getCurrentUser();
    const ownerId = user?.id || 'user_agent_001';
    return this.repository.createProject({
      ...input,
      ownerId,
    });
  }

  /**
   * 保存当前正在编辑的作品全量数据
   */
  async saveProject(document: ProjectDocument): Promise<ProjectSummary> {
    const user = await this.auth.getCurrentUser();
    const ownerId = user?.id || 'user_agent_001';
    return this.repository.saveProjectDocument(document, ownerId);
  }

  /**
   * 复制作品 (生成深拷贝独立副本)
   */
  async duplicateProject(projectId: string): Promise<ProjectSummary> {
    return this.repository.duplicateProject(projectId);
  }

  /**
   * 重命名作品
   */
  async renameProject(projectId: string, newName: string): Promise<ProjectSummary> {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('作品名称不能为空');
    }
    return this.repository.renameProject(projectId, trimmed);
  }

  /**
   * 归档作品
   */
  async archiveProject(projectId: string): Promise<void> {
    return this.repository.archiveProject(projectId);
  }

  /**
   * 彻底删除作品
   */
  async deleteProject(projectId: string): Promise<void> {
    return this.repository.deleteProject(projectId);
  }
}

// 导出统一作品业务服务单例
export const projectService = new ProjectService();
