import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Archive,
  Clock,
  BookOpen,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  X,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { ProjectSummary } from '../types/project';
import { UserAccount } from '../types/account';
import { projectService } from '../services/projectService';
import { authService, MOCK_LOCAL_USERS } from '../services/authService';
import { pricingService } from '../services/pricingService';
import { PRODUCT_SPECS } from '../data/productSpecs';

interface ProjectManagerModalProps {
  isOpen: boolean;
  currentProjectId?: string;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onToast?: (message: string) => void;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  currentProjectId,
  onClose,
  onSelectProject,
  onToast,
}) => {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'draft' | 'archived'>('all');

  // 新建作品弹窗状态
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [newClientName, setNewClientName] = useState<string>('');
  const [newSpecId, setNewSpecId] = useState<string>('square_8inch_book');

  // 重命名弹窗状态
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  // 加载用户与作品列表
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      const list = await projectService.listUserProjects({
        status: activeTab === 'all' ? undefined : activeTab,
      });
      setProjects(list);
    } catch (err) {
      console.error('加载作品列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // 切换模拟身份
  const handleSwitchUser = async (userId: string) => {
    if (authService.switchUser) {
      const u = await authService.switchUser(userId);
      setCurrentUser(u);
      loadData();
      if (onToast) onToast(`已切换身份为：${u.name} (${u.role})`);
    }
  };

  // 创建新作品
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const summary = await projectService.createProject({
        name: newProjectName.trim(),
        productSpecId: newSpecId,
        clientName: newClientName.trim() || undefined,
      });
      setIsCreating(false);
      setNewProjectName('');
      setNewClientName('');
      await loadData();
      if (onToast) onToast(`成功新建作品「${summary.name}」`);
      onSelectProject(summary.projectId);
      onClose();
    } catch (err: any) {
      alert(`创建失败: ${err.message}`);
    }
  };

  // 复制作品
  const handleDuplicate = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const summary = await projectService.duplicateProject(projectId);
      await loadData();
      if (onToast) onToast(`已创建副本「${summary.name}」`);
    } catch (err: any) {
      alert(`复制失败: ${err.message}`);
    }
  };

  // 归档作品
  const handleArchive = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await projectService.archiveProject(projectId);
      await loadData();
      if (onToast) onToast('作品已移至归档列表');
    } catch (err: any) {
      alert(`归档失败: ${err.message}`);
    }
  };

  // 删除作品
  const handleDelete = async (projectId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`确定要永久删除作品「${name}」吗？此操作不可恢复。`)) {
      return;
    }
    try {
      await projectService.deleteProject(projectId);
      await loadData();
      if (onToast) onToast(`已删除作品「${name}」`);
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  // 提交重命名
  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingProjectId || !renameValue.trim()) return;
    try {
      await projectService.renameProject(renamingProjectId, renameValue.trim());
      setRenamingProjectId(null);
      await loadData();
      if (onToast) onToast('作品名称已更新');
    } catch (err: any) {
      alert(`重命名失败: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="relative flex flex-col w-full max-w-5xl h-[85vh] max-h-[780px] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* 顶部 Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                作品管理中心
                <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  多作品架构
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                支持代理商批量多工程管理、快速复制、规格隔离与价格计算
              </p>
            </div>
          </div>

          {/* 切换模拟身份 (开发/代理商测试) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-slate-500">身份:</span>
              <select
                className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
                value={currentUser?.id || ''}
                onChange={(e) => handleSwitchUser(e.target.value)}
              >
                {MOCK_LOCAL_USERS.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role === 'agent' ? '代理商' : u.role === 'designer' ? '设计师' : '用户'})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 次级工具栏与筛选 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-md transition ${
                activeTab === 'all' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              全部作品 ({projects.length})
            </button>
            <button
              onClick={() => setActiveTab('draft')}
              className={`px-3 py-1 rounded-md transition ${
                activeTab === 'draft' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              草稿中
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1 rounded-md transition ${
                activeTab === 'archived' ? 'bg-white text-indigo-600 shadow-xs font-semibold' : 'hover:text-slate-900'
              }`}
            >
              已归档
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 px-2.5 py-1.5 rounded-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              新建作品
            </button>
          </div>
        </div>

        {/* 作品列表主体区 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {loading && projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
              正在加载作品库...
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl bg-white">
              <FolderOpen className="w-10 h-10 text-slate-300 mb-2" />
              <p className="font-medium text-slate-600">暂无作品记录</p>
              <p className="text-xs text-slate-400 mt-1">点击右上角「新建作品」开始排版设计</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => {
                const spec = PRODUCT_SPECS[project.productSpecId] || PRODUCT_SPECS.square_8inch_book;
                const isCurrent = project.projectId === currentProjectId;

                // 纯实时价格计算
                const priceBreakdown = pricingService.calculatePrice({
                  productSpec: spec,
                  pageCount: project.pageCount || 20,
                  quantity: 1,
                  context: {
                    role: currentUser?.role || 'agent',
                    priceTier: currentUser?.tierId || 'tier_agent_gold',
                  },
                });

                return (
                  <div
                    key={project.projectId}
                    onClick={() => {
                      onSelectProject(project.projectId);
                      onClose();
                    }}
                    className={`group relative flex flex-col justify-between bg-white rounded-xl p-4 border transition-all cursor-pointer ${
                      isCurrent
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    {/* 卡片头部 */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition">
                            {project.name}
                          </h3>
                          {project.clientName && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate">
                              客户: <span className="text-slate-700">{project.clientName}</span>
                            </p>
                          )}
                        </div>

                        {/* 当前打开标记或状态 */}
                        {isCurrent ? (
                          <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 className="w-3 h-3" />
                            正在编辑
                          </span>
                        ) : (
                          <span
                            className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-md font-medium ${
                              project.status === 'archived'
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {project.status === 'archived' ? '已归档' : '草稿'}
                          </span>
                        )}
                      </div>

                      {/* 产品规格与页数 */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                        <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          <BookOpen className="w-3 h-3 text-slate-400" />
                          {spec?.name || project.productSpecId}
                        </span>
                        <span>{project.pageCount} 页</span>
                      </div>

                      {/* 预估价格明细预览 */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-100/80 mb-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-900 font-medium">
                          <Tag className="w-3.5 h-3.5 text-amber-600" />
                          <span>预估结算:</span>
                          <span className="font-semibold text-amber-700 text-sm">
                            {pricingService.formatPrice(priceBreakdown.total)}
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-700/80">
                          {priceBreakdown.tierDescription || '标准价'}
                        </span>
                      </div>
                    </div>

                    {/* 卡片底部操作栏 */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3" />
                        {new Date(project.lastEditedAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                        <button
                          title="重命名"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingProjectId(project.projectId);
                            setRenameValue(project.name);
                          }}
                          className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="复制作品 (深拷贝副本)"
                          onClick={(e) => handleDuplicate(project.projectId, e)}
                          className="p-1 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {project.status !== 'archived' && (
                          <button
                            title="归档"
                            onClick={(e) => handleArchive(project.projectId, e)}
                            className="p-1 hover:text-amber-600 hover:bg-amber-50 rounded"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          title="删除作品"
                          onClick={(e) => handleDelete(project.projectId, project.name, e)}
                          className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 新建作品 Modal */}
        {isCreating && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-800">新建印刷定制作品</h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    作品名称 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="如：2026 巴黎蜜月精装相册"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">客户姓名/备注 (选填)</label>
                  <input
                    type="text"
                    placeholder="如：李先生家庭订制"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">产品物理规格</label>
                  <select
                    value={newSpecId}
                    onChange={(e) => setNewSpecId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    {Object.values(PRODUCT_SPECS).map((spec) => (
                      <option key={spec.id} value={spec.id}>
                        {spec.name} ({spec.widthMm}x{spec.heightMm}mm)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-xs transition"
                  >
                    立即创建并排版
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 重命名 Modal */}
        {renamingProjectId && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">重命名作品</h3>
              <form onSubmit={handleRenameSubmit} className="space-y-3 text-xs">
                <input
                  type="text"
                  required
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRenamingProjectId(null)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-xs"
                  >
                    保存名称
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
