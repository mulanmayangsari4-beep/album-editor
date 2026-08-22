import { ProjectDocument, PageModel, UploadedPhoto, ProductSpec } from '../types/editor';
import { ProjectSummary, CreateProjectInput, ProjectFilterOptions } from '../types/project';
import { PRODUCT_SPECS } from '../data/productSpecs';
import { DEFAULT_BOOK_SPEC } from '../data/defaultTemplates';
import { migrateProjectDocument } from '../utils/projectSerializer';

/**
 * 作品仓储抽象接口 (ProjectRepository)
 * 定义标准的 CRUD 与工程生命周期方法，屏蔽本地 IndexedDB 与远程 REST API 差异
 */
export interface ProjectRepository {
  /**
   * 获取指定用户的所有作品轻量级摘要列表
   */
  listProjects(ownerId: string, filter?: ProjectFilterOptions): Promise<ProjectSummary[]>;

  /**
   * 读取单个作品的完整设计文档 (包含所有 pages 与 elements)
   */
  getProject(projectId: string): Promise<ProjectDocument | null>;

  /**
   * 新建作品
   */
  createProject(input: CreateProjectInput): Promise<ProjectSummary>;

  /**
   * 保存或全量覆盖作品文档实体 (自动同步更新摘要索引)
   */
  saveProjectDocument(projectDoc: ProjectDocument, ownerId?: string): Promise<ProjectSummary>;

  /**
   * 函数式原子更新作品文档
   */
  updateProject(
    projectId: string,
    updater: (project: ProjectDocument) => ProjectDocument
  ): Promise<ProjectSummary>;

  /**
   * 复制作品 (生成完全解耦的副本，pages 与 slots 深拷贝)
   */
  duplicateProject(projectId: string): Promise<ProjectSummary>;

  /**
   * 重命名作品
   */
  renameProject(projectId: string, newName: string): Promise<ProjectSummary>;

  /**
   * 归档作品
   */
  archiveProject(projectId: string): Promise<void>;

  /**
   * 永久删除作品实体及其索引
   */
  deleteProject(projectId: string): Promise<void>;
}

// IndexedDB 数据库名称与版本
const DB_NAME = 'MomoPhotoEditorDB';
const DB_VERSION = 1;
const STORE_PROJECT_DOCS = 'project_documents';
const STORE_PROJECT_SUMMARIES = 'project_summaries';

const FALLBACK_SUMMARIES_KEY = 'momo_fallback_project_summaries';
const FALLBACK_DOC_PREFIX = 'momo_fallback_project_doc_';

/**
 * 健壮的 IndexedDB Promise 包装器 (含浏览器隐身模式降级支持)
 */
class IndexedDBStorage {
  private dbPromise: Promise<IDBDatabase | null>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private async initDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_PROJECT_DOCS)) {
            db.createObjectStore(STORE_PROJECT_DOCS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_PROJECT_SUMMARIES)) {
            db.createObjectStore(STORE_PROJECT_SUMMARIES, { keyPath: 'projectId' });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn('[IndexedDBStorage] IndexedDB 打开失败，降级为内存/LocalStorage 模式');
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  async getDoc(id: string): Promise<ProjectDocument | null> {
    const db = await this.dbPromise;
    if (!db) {
      const raw = localStorage.getItem(`${FALLBACK_DOC_PREFIX}${id}`);
      return raw ? migrateProjectDocument(JSON.parse(raw)) : null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PROJECT_DOCS, 'readonly');
        const store = tx.objectStore(STORE_PROJECT_DOCS);
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) {
            resolve(migrateProjectDocument(req.result));
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async setDoc(doc: ProjectDocument): Promise<void> {
    const db = await this.dbPromise;
    if (!db) {
      try {
        localStorage.setItem(`${FALLBACK_DOC_PREFIX}${doc.id}`, JSON.stringify(doc));
      } catch (err) {
        console.error('[IndexedDBStorage] LocalStorage 存储溢出:', err);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_PROJECT_DOCS, 'readwrite');
        const store = tx.objectStore(STORE_PROJECT_DOCS);
        const req = store.put(doc);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteDoc(id: string): Promise<void> {
    const db = await this.dbPromise;
    if (!db) {
      localStorage.removeItem(`${FALLBACK_DOC_PREFIX}${id}`);
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PROJECT_DOCS, 'readwrite');
        const store = tx.objectStore(STORE_PROJECT_DOCS);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async getAllSummaries(): Promise<ProjectSummary[]> {
    const db = await this.dbPromise;
    if (!db) {
      try {
        const raw = localStorage.getItem(FALLBACK_SUMMARIES_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PROJECT_SUMMARIES, 'readonly');
        const store = tx.objectStore(STORE_PROJECT_SUMMARIES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async setSummary(summary: ProjectSummary): Promise<void> {
    const db = await this.dbPromise;
    // 始终向 LocalStorage 做索引镜像备份以便极速直读
    try {
      const summaries = await this.getAllSummaries();
      const idx = summaries.findIndex((s) => s.projectId === summary.projectId);
      if (idx >= 0) {
        summaries[idx] = summary;
      } else {
        summaries.unshift(summary);
      }
      localStorage.setItem(FALLBACK_SUMMARIES_KEY, JSON.stringify(summaries));
    } catch {
      // ignore
    }

    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_PROJECT_SUMMARIES, 'readwrite');
        const store = tx.objectStore(STORE_PROJECT_SUMMARIES);
        const req = store.put(summary);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async deleteSummary(projectId: string): Promise<void> {
    try {
      const summaries = await this.getAllSummaries();
      const filtered = summaries.filter((s) => s.projectId !== projectId);
      localStorage.setItem(FALLBACK_SUMMARIES_KEY, JSON.stringify(filtered));
    } catch {
      // ignore
    }

    const db = await this.dbPromise;
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_PROJECT_SUMMARIES, 'readwrite');
        const store = tx.objectStore(STORE_PROJECT_SUMMARIES);
        const req = store.delete(projectId);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

/**
 * 本地作品仓储实现 (LocalProjectRepository)
 * 采用 IndexedDB 承载大型工程实体，以 ProjectSummary 作为轻量化元数据索引
 */
export class LocalProjectRepository implements ProjectRepository {
  private db: IndexedDBStorage;
  private initialized: boolean = false;

  constructor() {
    this.db = new IndexedDBStorage();
  }

  /**
   * 初始化引导默认工程 (代理商多案例工程)
   */
  private async ensureInitialized(ownerId: string): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    const existing = await this.db.getAllSummaries();
    if (existing.length === 0) {
      // 自动初始化 3 本不同场景的示例作品，便于代理商测试
      const initialProjects: { name: string; specId: string; clientName: string; notes: string }[] = [
        {
          name: '2026年·巴黎蜜月唯美浪漫纪念册',
          specId: 'square_8inch_book',
          clientName: '张小姐 & 陈先生',
          notes: '婚礼外景写真排版，客户加急印制',
        },
        {
          name: '小宝成长记·三周岁趣味写真集',
          specId: 'a4_landscape_book',
          clientName: '李先生家庭',
          notes: '横版精装典藏，预留 24 页',
        },
        {
          name: '2026年度·极简桌面工作日程台历',
          specId: 'desk_calendar_vertical',
          clientName: '上海米莫文化创意',
          notes: '企业内部新年定制礼品',
        },
      ];

      for (let i = 0; i < initialProjects.length; i++) {
        const item = initialProjects[i];
        const spec = PRODUCT_SPECS[item.specId] || DEFAULT_BOOK_SPEC;
        const projectId = `proj_init_${Date.now()}_${i + 1}`;
        const pages = this.createEmptyPagesForSpec(spec);

        const doc: ProjectDocument = {
          schemaVersion: 2,
          id: projectId,
          title: item.name,
          productSpec: spec,
          productSpecSnapshot: {
            snapshotId: `snap_${Date.now()}_${i}`,
            productSpecId: spec.id,
            version: 1,
            frozenAt: Date.now(),
            spec,
          },
          pages,
          photos: [],
          createdAt: Date.now() - (3 - i) * 86400000,
          updatedAt: Date.now() - (3 - i) * 3600000,
        };

        const summary: ProjectSummary = {
          projectId,
          ownerId,
          name: item.name,
          productType: spec.productType,
          productSpecId: spec.id,
          productSpecVersion: 1,
          status: 'draft',
          createdAt: new Date(doc.createdAt).toISOString(),
          updatedAt: new Date(doc.updatedAt).toISOString(),
          pageCount: pages.length,
          lastEditedAt: new Date(doc.updatedAt).toISOString(),
          clientName: item.clientName,
          notes: item.notes,
        };

        await this.db.setDoc(doc);
        await this.db.setSummary(summary);
      }
    }
  }

  private createEmptyPagesForSpec(spec: ProductSpec): PageModel[] {
    const defaultPages = spec.defaultPages || 20;
    const pages: PageModel[] = [];
    
    // 封面
    pages.push({
      id: `p_cover_${Date.now()}`,
      pageNumber: 0,
      faceType: 'cover_front',
      isLeft: false,
      backgroundColor: '#FFFFFF',
      slots: [],
    });

    // 内页
    for (let i = 1; i <= defaultPages; i++) {
      pages.push({
        id: `p_inside_${Date.now()}_${i}`,
        pageNumber: i,
        faceType: i % 2 === 1 ? 'inside_left' : 'inside_right',
        isLeft: i % 2 === 1,
        backgroundColor: '#FFFFFF',
        slots: [],
      });
    }
    return pages;
  }

  async listProjects(ownerId: string, filter?: ProjectFilterOptions): Promise<ProjectSummary[]> {
    await this.ensureInitialized(ownerId);
    const all = await this.db.getAllSummaries();

    // 多租户与过滤
    let results = all.filter((p) => !filter?.ownerId || p.ownerId === filter.ownerId || p.ownerId === ownerId);

    if (filter?.status && filter.status !== 'all') {
      results = results.filter((p) => p.status === filter.status);
    }
    if (filter?.productType) {
      results = results.filter((p) => p.productType === filter.productType);
    }
    if (filter?.searchKeyword) {
      const kw = filter.searchKeyword.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(kw) ||
          p.clientName?.toLowerCase().includes(kw) ||
          p.notes?.toLowerCase().includes(kw)
      );
    }

    // 排序
    results.sort((a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime());
    return results;
  }

  async getProject(projectId: string): Promise<ProjectDocument | null> {
    return this.db.getDoc(projectId);
  }

  async createProject(input: CreateProjectInput): Promise<ProjectSummary> {
    const spec = PRODUCT_SPECS[input.productSpecId] || DEFAULT_BOOK_SPEC;
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const pages = this.createEmptyPagesForSpec(spec);

    const doc: ProjectDocument = {
      schemaVersion: 2,
      id: projectId,
      title: input.name,
      productSpec: spec,
      productSpecSnapshot: {
        snapshotId: `snap_${Date.now()}`,
        productSpecId: spec.id,
        version: 1,
        frozenAt: now,
        spec,
      },
      pages,
      photos: [],
      createdAt: now,
      updatedAt: now,
    };

    const summary: ProjectSummary = {
      projectId,
      ownerId: input.ownerId,
      name: input.name,
      productType: spec.productType,
      productSpecId: spec.id,
      productSpecVersion: 1,
      status: 'draft',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      pageCount: pages.length,
      lastEditedAt: new Date(now).toISOString(),
      clientName: input.clientName,
      notes: input.notes,
    };

    await this.db.setDoc(doc);
    await this.db.setSummary(summary);
    return summary;
  }

  async saveProjectDocument(projectDoc: ProjectDocument, ownerId: string = 'user_agent_001'): Promise<ProjectSummary> {
    const now = Date.now();
    const updatedDoc: ProjectDocument = {
      ...projectDoc,
      updatedAt: now,
    };

    await this.db.setDoc(updatedDoc);

    const existingSummaries = await this.db.getAllSummaries();
    const oldSummary = existingSummaries.find((s) => s.projectId === projectDoc.id);

    const summary: ProjectSummary = {
      projectId: projectDoc.id,
      ownerId: oldSummary?.ownerId || ownerId,
      name: projectDoc.title,
      productType: projectDoc.productSpec.productType,
      productSpecId: projectDoc.productSpec.id,
      productSpecVersion: projectDoc.productSpecSnapshot?.version || 1,
      status: oldSummary?.status || 'draft',
      createdAt: oldSummary?.createdAt || new Date(projectDoc.createdAt || now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      pageCount: projectDoc.pages.length,
      lastEditedAt: new Date(now).toISOString(),
      clientName: oldSummary?.clientName,
      notes: oldSummary?.notes,
    };

    await this.db.setSummary(summary);
    return summary;
  }

  async updateProject(
    projectId: string,
    updater: (project: ProjectDocument) => ProjectDocument
  ): Promise<ProjectSummary> {
    const existing = await this.getProject(projectId);
    if (!existing) {
      throw new Error(`作品 [${projectId}] 不存在`);
    }

    const updated = updater(existing);
    return this.saveProjectDocument(updated);
  }

  async duplicateProject(projectId: string): Promise<ProjectSummary> {
    const original = await this.getProject(projectId);
    if (!original) {
      throw new Error(`无法复制：未找到原始作品 [${projectId}]`);
    }

    const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const newTitle = `${original.title} - 副本`;

    // 核心安全原则：深拷贝所有 pages 与 slots，切断一切可变引用
    const clonedPages: PageModel[] = JSON.parse(JSON.stringify(original.pages)).map((page: PageModel, pIdx: number) => ({
      ...page,
      id: `p_dup_${Date.now()}_${pIdx}`,
      slots: (page.slots || []).map((slot: any, sIdx: number) => ({
        ...slot,
        id: `slot_dup_${Date.now()}_${pIdx}_${sIdx}`,
      })),
      elements: (page.elements || []).map((el: any, eIdx: number) => ({
        ...el,
        id: `el_dup_${Date.now()}_${pIdx}_${eIdx}`,
      })),
    }));

    // 照片素材元数据列表深拷贝 (assetId 共享素材实体，但数组与对象解耦)
    const clonedPhotos: UploadedPhoto[] = JSON.parse(JSON.stringify(original.photos || []));

    const clonedDoc: ProjectDocument = {
      ...JSON.parse(JSON.stringify(original)),
      id: newProjectId,
      title: newTitle,
      pages: clonedPages,
      photos: clonedPhotos,
      createdAt: now,
      updatedAt: now,
    };

    const summaries = await this.db.getAllSummaries();
    const oldSummary = summaries.find((s) => s.projectId === projectId);

    const newSummary: ProjectSummary = {
      projectId: newProjectId,
      ownerId: oldSummary?.ownerId || 'user_agent_001',
      name: newTitle,
      productType: clonedDoc.productSpec.productType,
      productSpecId: clonedDoc.productSpec.id,
      productSpecVersion: clonedDoc.productSpecSnapshot?.version || 1,
      status: 'draft',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      pageCount: clonedPages.length,
      lastEditedAt: new Date(now).toISOString(),
      clientName: oldSummary?.clientName ? `${oldSummary.clientName} (副本)` : undefined,
      notes: oldSummary?.notes,
    };

    await this.db.setDoc(clonedDoc);
    await this.db.setSummary(newSummary);
    return newSummary;
  }

  async renameProject(projectId: string, newName: string): Promise<ProjectSummary> {
    const doc = await this.getProject(projectId);
    if (doc) {
      doc.title = newName;
      return this.saveProjectDocument(doc);
    }
    throw new Error(`作品 [${projectId}] 不存在`);
  }

  async archiveProject(projectId: string): Promise<void> {
    const summaries = await this.db.getAllSummaries();
    const target = summaries.find((s) => s.projectId === projectId);
    if (target) {
      target.status = 'archived';
      target.updatedAt = new Date().toISOString();
      await this.db.setSummary(target);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.db.deleteDoc(projectId);
    await this.db.deleteSummary(projectId);
  }
}

// 导出统一作品仓储单例 (业务层仅依赖 ProjectRepository 接口)
export const projectRepository: ProjectRepository = new LocalProjectRepository();
