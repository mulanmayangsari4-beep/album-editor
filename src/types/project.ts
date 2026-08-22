import { ProductType } from './editor';

/**
 * 作品轻量级摘要模型 (ProjectSummary)
 * 用于作品列表、代理商批量管理、快速检索等场景
 * 严格与完整的 ProjectDocument 物理实体解耦，避免列表加载庞大的 pages/slots 数据
 */
export interface ProjectSummary {
  projectId: string;
  ownerId: string;

  name: string;

  productType: ProductType;
  productSpecId: string;
  productSpecVersion: number;

  thumbnailUrl?: string; // 封面缩略图

  status: 'draft' | 'completed' | 'archived';

  createdAt: string;
  updatedAt: string;

  pageCount: number;

  // 最近一次编辑时间
  lastEditedAt: string;

  // 扩展元数据 (如代理商客户姓名、备注等)
  clientName?: string;
  notes?: string;
}

/**
 * 创建新作品输入参数
 */
export interface CreateProjectInput {
  ownerId: string;
  name: string;
  productSpecId: string;
  productType?: ProductType;
  clientName?: string;
  notes?: string;
  initialPageCount?: number;
}

/**
 * 作品过滤与查询条件
 */
export interface ProjectFilterOptions {
  ownerId: string;
  status?: 'draft' | 'completed' | 'archived' | 'all';
  productType?: ProductType;
  searchKeyword?: string;
  sortBy?: 'lastEditedAt' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}
