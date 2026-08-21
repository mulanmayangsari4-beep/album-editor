import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  Trash2,
  Check,
  ChevronDown,
  Info,
  Layers,
  Sparkles,
  Palette,
  Image as ImageIcon,
  BookOpen,
  Plus,
  Bookmark,
  Smartphone,
  FolderKanban,
  History,
  Cloud,
  Film,
  Eye,
  AlertTriangle,
  CheckSquare,
  Square,
  ArrowUpDown,
  Filter,
  Loader2,
} from 'lucide-react';
import { UploadedPhoto, SidebarTab, FrameSlot, CustomUserLayout } from '../types/editor';
import {
  PRESET_LAYOUT_CATEGORIES,
  PRESET_SPREAD_LAYOUTS,
  PRESET_BACKGROUNDS,
} from '../data/defaultTemplates';
import { processLocalImageFile, formatBytes, formatDateTime } from '../utils/imageUtils';
import { PhotoDetailModal } from './PhotoDetailModal';
import { PhotoSourceModal, PhotoSourceTab } from './PhotoSourceModal';
import { MasksPanel } from './MasksPanel';
import { StampsPanel } from './StampsPanel';
import { MaskShape } from '../types/editor';
import { PresetStamp } from '../data/stamps';

interface PhotoTrayProps {
  activeTab: SidebarTab | null;
  photos: UploadedPhoto[];
  onAddPhotos: (newPhotos: UploadedPhoto[]) => void;
  onRemovePhoto: (id: string) => void;
  selectedSlotId: string | null;
  activeSide: 'left' | 'right' | null;
  onSelectSide: (side: 'left' | 'right') => void;
  onFillActiveSlot: (photoId: string) => void;
  onApplyLayoutToCurrentPage: (slots: FrameSlot[], targetPage: 'left' | 'right' | 'both') => void;
  onApplySpreadLayout: (leftSlots: FrameSlot[], rightSlots: FrameSlot[]) => void;
  onApplyBackgroundColor: (color: string, targetPage: 'left' | 'right' | 'both') => void;
  onApplyMask?: (maskId: MaskShape) => void;
  onAddStamp?: (stamp: PresetStamp) => void;
  currentPageNumber: { left: number; right: number };
  currentLeftSlots?: FrameSlot[];
  currentRightSlots?: FrameSlot[];
}

type SortOption =
  | 'upload_desc'
  | 'upload_asc'
  | 'capture_desc'
  | 'capture_asc'
  | 'name_asc'
  | 'name_desc'
  | 'size_desc';

export const PhotoTray: React.FC<PhotoTrayProps> = ({
  activeTab,
  photos,
  onAddPhotos,
  onRemovePhoto,
  selectedSlotId,
  activeSide,
  onSelectSide,
  onFillActiveSlot,
  onApplyLayoutToCurrentPage,
  onApplySpreadLayout,
  onApplyBackgroundColor,
  onApplyMask,
  onAddStamp,
  currentPageNumber,
  currentLeftSlots,
  currentRightSlots,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [thumbSize, setThumbSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [hideUsed, setHideUsed] = useState<boolean>(false);
  const [onlyVideo, setOnlyVideo] = useState<boolean>(false);
  const [sortOption, setSortOption] = useState<SortOption>('upload_desc');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // 浮层与弹窗状态
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [sourceModalTab, setSourceModalTab] = useState<PhotoSourceTab | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<UploadedPhoto | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 渐进式流式导入进度状态 (支持实时百分比、当前文件名、即刻可用提示)
  const [importProgress, setImportProgress] = useState<{
    total: number;
    current: number;
    currentName: string;
    percent: number;
    isProcessing: boolean;
    statusText?: string;
  } | null>(null);

  // 安全删除拦截弹窗状态
  const [deleteBlockedPhoto, setDeleteBlockedPhoto] = useState<{ photo: UploadedPhoto; count: number } | null>(null);

  // 版式抽屉顶栏：'system' 系统版式 vs 'custom' 我的版式
  const [layoutSubTab, setLayoutSubTab] = useState<'system' | 'custom'>('system');
  const [systemCategory, setSystemCategory] = useState<string>('all');

  // 我的版式存储与管理
  const [customLayouts, setCustomLayouts] = useState<CustomUserLayout[]>(() => {
    try {
      const saved = localStorage.getItem('mimo_custom_user_layouts');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const [isSavingCustom, setIsSavingCustom] = useState<boolean>(false);
  const [customNameInput, setCustomNameInput] = useState<string>('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  // 点击外部关闭 "+ 添加照片" 弹出菜单
  const addMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
    };
    if (isAddMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddMenuOpen]);

  // 处理本地照片上传 (分批渐进式流式读取：生成极轻量缩略图后立即入池，边导入边排版)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList: File[] = Array.from(files);
    const validImageFiles = fileList.filter((f: File) => f.type.startsWith('image/'));

    if (validImageFiles.length === 0) {
      showToast('未检测到有效的图片文件');
      e.target.value = '';
      return;
    }

    const total = validImageFiles.length;
    setIsUploading(true);
    setImportProgress({
      total,
      current: 0,
      currentName: validImageFiles[0]?.name || '',
      percent: 0,
      isProcessing: true,
      statusText: `准备极速导入 ${total} 张照片...`,
    });

    let completedCount = 0;
    const batchSize = 2; // 每次并发 2 张，保持主线程极度丝滑且图片实时冒泡呈现

    for (let i = 0; i < total; i += batchSize) {
      const batchFiles = validImageFiles.slice(i, i + batchSize);
      try {
        const batchResults = await Promise.all(
          batchFiles.map((file) => processLocalImageFile(file))
        );

        // 核心亮点：每完成一批立即追加进照片池，无需等待全部完成即可直接拖入排版！
        onAddPhotos(batchResults);
        completedCount += batchFiles.length;

        const percent = Math.min(100, Math.round((completedCount / total) * 100));
        setImportProgress({
          total,
          current: completedCount,
          currentName: batchFiles[batchFiles.length - 1]?.name || '',
          percent,
          isProcessing: completedCount < total,
          statusText: `正在极速载入 ${completedCount} / ${total} 张 (${percent}%)`,
        });
      } catch (err) {
        console.error('Error importing batch:', err);
      }
    }

    setImportProgress((prev) =>
      prev
        ? {
            ...prev,
            current: total,
            percent: 100,
            isProcessing: false,
            statusText: `✅ 成功载入全部 ${total} 张照片`,
          }
        : null
    );

    setIsUploading(false);
    showToast(`成功导入 ${total} 张本地照片`);
    e.target.value = '';

    // 2.2 秒后平滑隐藏进度条
    setTimeout(() => {
      setImportProgress(null);
    }, 2200);
  };

  // 拖拽文件到托盘区域
  const handleTrayDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
        handleFileChange({
          target: fileInputRef.current,
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  // 过滤照片列表 (彻底排除系统素材与图章，确保照片区仅展示用户上传的照片)
  const filteredPhotos = photos.filter((p) => {
    if (p.isSystemStamp || p.id.startsWith('stamp_asset_')) return false;
    if (hideUsed && p.usedCount > 0) return false;
    if (onlyVideo) {
      return (
        p.id.startsWith('asset_video') ||
        p.name.toLowerCase().includes('vid_frame') ||
        p.name.toLowerCase().includes('视频')
      );
    }
    return true;
  });

  // 排序照片列表
  const sortedPhotos = [...filteredPhotos].sort((a, b) => {
    switch (sortOption) {
      case 'upload_desc':
        return b.createdAt - a.createdAt;
      case 'upload_asc':
        return a.createdAt - b.createdAt;
      case 'capture_desc': {
        const timeA = a.captureTime || a.createdAt;
        const timeB = b.captureTime || b.createdAt;
        return timeB - timeA;
      }
      case 'capture_asc': {
        const timeA = a.captureTime || a.createdAt;
        const timeB = b.captureTime || b.createdAt;
        return timeA - timeB;
      }
      case 'name_asc':
        return a.name.localeCompare(b.name, 'zh-CN');
      case 'name_desc':
        return b.name.localeCompare(a.name, 'zh-CN');
      case 'size_desc':
        return (b.fileSize || 0) - (a.fileSize || 0);
      default:
        return b.createdAt - a.createdAt;
    }
  });

  const totalUsedPhotos = photos.filter((p) => p.usedCount > 0).length;

  // 清理所有未使用的照片
  const handleClearUnused = () => {
    const unused = photos.filter((p) => p.usedCount === 0);
    if (unused.length === 0) {
      showToast('当前没有未使用的照片');
      return;
    }
    unused.forEach((p) => onRemovePhoto(p.id));
    setSelectedPhotoIds(new Set());
    showToast(`已清空 ${unused.length} 张未使用照片`);
  };

  // 安全删除单张照片
  const handleAttemptDeletePhoto = (photo: UploadedPhoto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (photo.usedCount > 0) {
      // 正在使用中，弹出安全拦截提示
      setDeleteBlockedPhoto({ photo, count: photo.usedCount });
    } else {
      onRemovePhoto(photo.id);
      setSelectedPhotoIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
      showToast('已从照片池移除照片');
    }
  };

  // 批量删除选中的照片 (仅删除未使用的)
  const handleBatchDeleteSelected = () => {
    if (selectedPhotoIds.size === 0) return;
    const selectedList = photos.filter((p) => selectedPhotoIds.has(p.id));
    const usedSelected = selectedList.filter((p) => p.usedCount > 0);
    const unusedSelected = selectedList.filter((p) => p.usedCount === 0);

    if (unusedSelected.length > 0) {
      unusedSelected.forEach((p) => onRemovePhoto(p.id));
      setSelectedPhotoIds(new Set(usedSelected.map((p) => p.id)));
      if (usedSelected.length > 0) {
        showToast(`已删除 ${unusedSelected.length} 张，另有 ${usedSelected.length} 张正用于画册`);
      } else {
        showToast(`已成功删除选中的 ${unusedSelected.length} 张照片`);
      }
    } else if (usedSelected.length > 0) {
      showToast('所选照片均正在画册中排版使用，无法直接删除');
    }
  };

  // 处理照片点击 (支持普通点击、Ctrl/Cmd 增量多选、Shift 连续范围多选)
  const handlePhotoClick = (photo: UploadedPhoto, e: React.MouseEvent) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isShift && lastSelectedId && sortedPhotos.length > 0) {
      // Shift 范围多选
      const lastIndex = sortedPhotos.findIndex((p) => p.id === lastSelectedId);
      const currentIndex = sortedPhotos.findIndex((p) => p.id === photo.id);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = sortedPhotos.slice(start, end + 1).map((p) => p.id);
        const next = new Set(selectedPhotoIds);
        rangeIds.forEach((id) => next.add(id));
        setSelectedPhotoIds(next);
        setLastSelectedId(photo.id);
        return;
      }
    }

    if (isCtrlOrCmd) {
      // Ctrl / Cmd 增量反选
      const next = new Set(selectedPhotoIds);
      if (next.has(photo.id)) {
        next.delete(photo.id);
      } else {
        next.add(photo.id);
      }
      setSelectedPhotoIds(next);
      setLastSelectedId(photo.id);
      return;
    }

    // 普通单击：若当前有活跃画框，则填入；若无则单选选中
    if (selectedSlotId) {
      onFillActiveSlot(photo.id);
      showToast('已填入当前选中画框');
    } else {
      const next = new Set(selectedPhotoIds);
      if (next.has(photo.id) && next.size === 1) {
        next.clear();
      } else {
        next.clear();
        next.add(photo.id);
      }
      setSelectedPhotoIds(next);
      setLastSelectedId(photo.id);
    }
  };

  // 双击照片快速放入当前选中画框
  const handlePhotoDoubleClick = (photo: UploadedPhoto) => {
    if (selectedSlotId) {
      onFillActiveSlot(photo.id);
      showToast('已快速放入当前选中画框');
    } else {
      showToast('💡 提示：请先在画板中点击选中一个照片框，或直接将照片拖入框中');
    }
  };

  // 保存自定义版式到 localStorage
  const handleSaveCurrentAsCustomLayout = () => {
    const currentSlots = activeSide === 'right' ? currentRightSlots : currentLeftSlots;
    if (!currentSlots || currentSlots.length === 0) {
      setSaveToast('当前页面为空白，无法保存为空版式');
      setTimeout(() => setSaveToast(null), 2500);
      return;
    }

    const layoutName = customNameInput.trim() || `我的版式 ${customLayouts.length + 1}`;

    const cleanedSlots: FrameSlot[] = currentSlots.map((s, idx) => ({
      ...s,
      id: `custom_slot_${Date.now()}_${idx}`,
      photoId: undefined,
      crop: undefined,
    }));

    const newLayout: CustomUserLayout = {
      id: `custom_${Date.now()}`,
      name: layoutName,
      createdAt: Date.now(),
      slots: cleanedSlots,
      photoCount: cleanedSlots.filter((s) => s.type === 'photo').length,
    };

    const nextList = [newLayout, ...customLayouts];
    setCustomLayouts(nextList);
    try {
      localStorage.setItem('mimo_custom_user_layouts', JSON.stringify(nextList));
    } catch {
      // ignore
    }

    setIsSavingCustom(false);
    setCustomNameInput('');
    setSaveToast(`已成功保存「${layoutName}」到我的版式`);
    setTimeout(() => setSaveToast(null), 2500);
  };

  const handleDeleteCustomLayout = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextList = customLayouts.filter((l) => l.id !== id);
    setCustomLayouts(nextList);
    try {
      localStorage.setItem('mimo_custom_user_layouts', JSON.stringify(nextList));
    } catch {
      // ignore
    }
  };

  if (!activeTab) return null;

  return (
    <div
      id="left-secondary-panel"
      className="w-80 bg-[#f8f9fa] border-r border-[#e0e2e6] flex flex-col justify-between select-none z-10 shrink-0 text-[#202124] relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleTrayDrop}
    >
      {/* 顶部操作 Toast 浮层 */}
      {toastMessage && (
        <div className="absolute top-2 inset-x-3 z-30 py-1.5 px-3 bg-neutral-900/90 text-white text-[11px] rounded shadow-lg flex items-center justify-between animate-fade-in pointer-events-none">
          <span>{toastMessage}</span>
          <Info className="w-3.5 h-3.5 text-amber-300 ml-1.5 shrink-0" />
        </div>
      )}

      {/* ===== TAB 1: 照片面板 (升级为专业照片资产管理中心) ===== */}
      {activeTab === 'photos' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 顶部控制栏 (排序、缩略图大小、复选筛选) */}
          <div className="p-3 border-b border-[#e5e7eb] space-y-2 bg-[#f8f9fa]">
            <div className="flex items-center justify-between">
              {/* 排序下拉 */}
              <div className="relative">
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="text-xs bg-white border border-[#dadce0] text-neutral-700 rounded px-2 py-1 outline-none cursor-pointer pr-6 appearance-none shadow-xs font-medium"
                >
                  <option value="upload_desc">上传时间 (最新)</option>
                  <option value="upload_asc">上传时间 (最早)</option>
                  <option value="capture_desc">拍摄时间 (最新)</option>
                  <option value="capture_asc">拍摄时间 (最早)</option>
                  <option value="name_asc">文件名称 (A-Z)</option>
                  <option value="name_desc">文件名称 (Z-A)</option>
                  <option value="size_desc">文件大小 (从大到小)</option>
                </select>
                <ChevronDown className="w-3 h-3 text-neutral-400 absolute right-1.5 top-2 pointer-events-none" />
              </div>

              {/* 缩略图尺寸切换 */}
              <div className="flex items-center space-x-1 text-xs text-neutral-500">
                <span className="text-[11px]">视图:</span>
                <button
                  onClick={() => setThumbSize('small')}
                  className={`px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                    thumbSize === 'small'
                      ? 'bg-[#e0e2e6] text-neutral-900 font-semibold'
                      : 'hover:bg-neutral-200 text-neutral-600'
                  }`}
                  title="3列紧凑缩略图"
                >
                  小
                </button>
                <button
                  onClick={() => setThumbSize('medium')}
                  className={`px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                    thumbSize === 'medium'
                      ? 'bg-[#e0e2e6] text-neutral-900 font-semibold'
                      : 'hover:bg-neutral-200 text-neutral-600'
                  }`}
                  title="2列舒适缩略图 (默认)"
                >
                  中
                </button>
                <button
                  onClick={() => setThumbSize('large')}
                  className={`px-1.5 py-0.5 rounded text-[11px] cursor-pointer transition-colors ${
                    thumbSize === 'large'
                      ? 'bg-[#e0e2e6] text-neutral-900 font-semibold'
                      : 'hover:bg-neutral-200 text-neutral-600'
                  }`}
                  title="1列大图预览"
                >
                  大
                </button>
              </div>
            </div>

            {/* 筛选勾选框与快捷键说明 */}
            <div className="flex items-center justify-between text-[11px] text-neutral-600 pt-1 border-t border-neutral-200/60">
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideUsed}
                  onChange={(e) => setHideUsed(e.target.checked)}
                  className="rounded text-[#76383d] focus:ring-0 cursor-pointer"
                />
                <span>隐藏已使用照片</span>
              </label>

              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyVideo}
                  onChange={(e) => setOnlyVideo(e.target.checked)}
                  className="rounded text-[#76383d] focus:ring-0 cursor-pointer"
                />
                <span>只看视频照片</span>
              </label>

              <span className="text-[10px] text-neutral-400 font-mono" title="支持 Ctrl/Cmd 增量多选，Shift 连续多选">
                Ctrl/Shift 多选
              </span>
            </div>
          </div>

          {/* 多选批量操作状态条 (当有勾选时呈现) */}
          {selectedPhotoIds.size > 0 && (
            <div className="px-3 py-1.5 bg-[#f5eef0] border-b border-[#ebdbe0] flex items-center justify-between text-xs text-[#76383d] font-medium animate-fade-in shrink-0">
              <span>已选择 {selectedPhotoIds.size} 张照片</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleBatchDeleteSelected}
                  className="text-xs hover:underline text-[#76383d] font-medium cursor-pointer"
                >
                  删除未用
                </button>
                <button
                  onClick={() => setSelectedPhotoIds(new Set())}
                  className="text-xs hover:underline text-neutral-600 cursor-pointer"
                >
                  取消选择
                </button>
              </div>
            </div>
          )}

          {/* 🚀 实时极速导入进度卡片 (进度条、当前文件、百分比、即刻拖拽提示) */}
          {importProgress && (
            <div className="mx-3 mt-2 mb-1 p-2.5 bg-white rounded-lg border border-[#e0e2e6] shadow-xs animate-fade-in text-xs space-y-1.5 shrink-0 transition-all">
              <div className="flex items-center justify-between text-neutral-700 font-medium">
                <div className="flex items-center space-x-1.5 overflow-hidden">
                  {importProgress.isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#76383d] animate-spin shrink-0" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                  )}
                  <span className="truncate text-[11px] font-medium text-neutral-800">
                    {importProgress.statusText || `正在载入照片 (${importProgress.current}/${importProgress.total})`}
                  </span>
                </div>
                <span className="font-mono text-[11px] font-bold text-[#76383d] shrink-0 ml-2">
                  {importProgress.percent}%
                </span>
              </div>

              {/* 进度条轨道 */}
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-[#944c52] to-[#76383d] rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span className="truncate max-w-[170px]" title={importProgress.currentName}>
                  {importProgress.currentName ? `文件: ${importProgress.currentName}` : '正在处理...'}
                </span>
                <span className="text-emerald-700 font-medium bg-emerald-50 px-1 py-0.5 rounded text-[9px]">
                  {importProgress.isProcessing ? '可立即拖入排版' : '已就绪'}
                </span>
              </div>
            </div>
          )}

          {/* 照片流列表区 / 空白引导区 */}
          <div className="flex-1 overflow-y-auto p-3">
            {sortedPhotos.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-start text-xs text-neutral-500 space-y-3 px-2 py-8">
                <p className="font-semibold text-neutral-700 text-sm">如何添加照片</p>
                <div className="space-y-1.5 text-neutral-600 leading-relaxed">
                  <p>方法 1：拖拽电脑/手机照片到此处上传</p>
                  <p>方法 2：点击底部红色按钮【+ 添加照片】</p>
                  <p>支持多渠道：手机扫码、其他作品、历史云端照片与视频截帧</p>
                </div>
                <div className="mt-4 p-3 bg-[#f1f3f4] rounded text-[11px] text-neutral-500 border border-[#e0e2e6]">
                  <p className="font-medium text-neutral-700 mb-1">💡 智能提示：</p>
                  <p>支持双击照片快速放入选中画框，也可直接拖入画框进行替换（换照片，不换画框）。</p>
                </div>
              </div>
            ) : (
              <div
                className={`grid gap-2 ${
                  thumbSize === 'small'
                    ? 'grid-cols-3'
                    : thumbSize === 'medium'
                    ? 'grid-cols-2'
                    : 'grid-cols-1'
                }`}
              >
                {sortedPhotos.map((photo) => {
                  const isSelected = selectedPhotoIds.has(photo.id);
                  const isUsed = photo.usedCount > 0;

                  return (
                    <div
                      key={photo.id}
                      id={`photo-tray-item-${photo.id}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', photo.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={(e) => handlePhotoClick(photo, e)}
                      onDoubleClick={() => handlePhotoDoubleClick(photo)}
                      className={`group relative ${
                        thumbSize === 'large' ? 'aspect-4/3' : 'aspect-square'
                      } rounded-md bg-neutral-200 overflow-hidden cursor-grab active:cursor-grabbing border transition-all ${
                        isSelected
                          ? 'border-[#76383d] ring-2 ring-[#76383d]/50 shadow-sm'
                          : 'border-[#dadce0] hover:border-neutral-400 shadow-2xs'
                      }`}
                      title={`${photo.name} (${photo.naturalWidth}×${photo.naturalHeight}px) - 双击放入 / 拖拽入画框`}
                    >
                      {/* 照片缩略图 (优先使用 400px 轻量级缩略图，开启懒加载与异步解码，支撑海量照片流畅预览) */}
                      <img
                        src={photo.thumbnailUrl || photo.thumbUrl || photo.url}
                        alt={photo.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover select-none pointer-events-none"
                      />

                      {/* 左上角：排版使用次数角标 (1:1 动态实时同步) */}
                      {isUsed && (
                        <div
                          className="absolute top-1 left-1 bg-black/75 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold z-10 shadow-xs flex items-center space-x-0.5"
                          title={`当前画册已引用 ${photo.usedCount} 次`}
                        >
                          <span>已用</span>
                          <span className="text-amber-300 font-bold">{photo.usedCount}</span>
                        </div>
                      )}

                      {/* 多选勾选标记 */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-[#76383d] text-white p-0.5 rounded-full shadow-xs z-10">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}

                      {/* 悬浮操作按钮组 (大图预览、删除) */}
                      <div className="absolute top-1 right-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        {/* 大图预览按钮 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPhoto(photo);
                          }}
                          className="p-1 bg-black/70 hover:bg-neutral-800 text-white rounded cursor-pointer shadow-xs"
                          title="查看大图与 EXIF 详情"
                        >
                          <Eye className="w-2.5 h-2.5" />
                        </button>

                        {/* 删除按钮 */}
                        <button
                          onClick={(e) => handleAttemptDeletePhoto(photo, e)}
                          className="p-1 bg-black/70 hover:bg-[#76383d] text-white rounded cursor-pointer shadow-xs"
                          title={isUsed ? `已在画册中使用 ${photo.usedCount} 次 (点击查看安全提示)` : '从照片池删除'}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* 底部文件名与尺寸信息栏 */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate font-sans px-0.5">{photo.name}</p>
                        <p className="text-[9px] text-neutral-300 truncate font-mono px-0.5">
                          {photo.naturalWidth}×{photo.naturalHeight} · {formatBytes(photo.fileSize || 0)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 底部统计栏与多渠道添加照片入口 (1:1 还原米莫印品成熟设计) */}
          <div className="p-3 border-t border-[#e0e2e6] bg-white space-y-2 relative">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span className="text-neutral-700 font-medium">
                共 {photos.length} 张，已排版 {totalUsedPhotos} 张
              </span>
              <button
                onClick={handleClearUnused}
                className="text-[#76383d] hover:underline text-[11px] font-medium cursor-pointer"
                title="一键移除照片池中所有未放入画框的照片"
              >
                清理未用
              </button>
            </div>

            {/* 隐藏的本地文件 Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/jpg"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* "+ 添加照片" 主按钮与多渠道下拉菜单 */}
            <div className="relative" ref={addMenuRef}>
              <button
                id="btn-upload-photos-tray"
                onClick={() => setIsAddMenuOpen((prev) => !prev)}
                className="w-full py-2.5 bg-[#76383d] hover:bg-[#632c30] active:bg-[#522125] text-white rounded text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer tracking-wide"
              >
                <Plus className="w-4 h-4" />
                <span>+ 添加照片</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 ml-1 transition-transform duration-200 ${
                    isAddMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* 多渠道添加入口弹出菜单 */}
              {isAddMenuOpen && (
                <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-white rounded-lg shadow-xl border border-neutral-200 py-1.5 z-40 text-xs animate-fade-in divide-y divide-neutral-100">
                  <div className="py-1">
                    {/* 1. 本地上传 (真正实现) */}
                    <button
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-3.5 py-2 flex items-center space-x-2.5 hover:bg-neutral-100 text-neutral-800 text-left cursor-pointer transition-colors font-medium"
                    >
                      <UploadCloud className="w-4 h-4 text-[#76383d]" />
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-900">本地电脑上传</div>
                        <div className="text-[10px] text-neutral-400">支持 JPG, PNG, WEBP 高清多选批量导入</div>
                      </div>
                    </button>
                  </div>

                  <div className="py-1">
                    {/* 2. 手机扫码上传 */}
                    <button
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        setSourceModalTab('mobile');
                      }}
                      className="w-full px-3.5 py-1.5 flex items-center space-x-2.5 hover:bg-neutral-100 text-neutral-700 text-left cursor-pointer transition-colors"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>手机扫码上传</span>
                    </button>

                    {/* 3. 从其他作品选择 */}
                    <button
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        setSourceModalTab('projects');
                      }}
                      className="w-full px-3.5 py-1.5 flex items-center space-x-2.5 hover:bg-neutral-100 text-neutral-700 text-left cursor-pointer transition-colors"
                    >
                      <FolderKanban className="w-4 h-4 text-amber-600" />
                      <span>从其他作品选择</span>
                    </button>

                    {/* 4. 云端历史照片 */}
                    <button
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        setSourceModalTab('history');
                      }}
                      className="w-full px-3.5 py-1.5 flex items-center space-x-2.5 hover:bg-neutral-100 text-neutral-700 text-left cursor-pointer transition-colors"
                    >
                      <History className="w-4 h-4 text-blue-600" />
                      <span>云端历史照片</span>
                    </button>

                    {/* 5. 百度网盘导入 */}
                    <button
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        setSourceModalTab('netdisk');
                      }}
                      className="w-full px-3.5 py-1.5 flex items-center space-x-2.5 hover:bg-neutral-100 text-neutral-700 text-left cursor-pointer transition-colors"
                    >
                      <Cloud className="w-4 h-4 text-cyan-600" />
                      <span>百度网盘导入</span>
                    </button>

                    {/* 6. 视频截帧提取 */}
                    <button
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        setSourceModalTab('video');
                      }}
                      className="w-full px-3.5 py-1.5 flex items-center space-x-2.5 hover:bg-neutral-100 text-neutral-700 text-left cursor-pointer transition-colors"
                    >
                      <Film className="w-4 h-4 text-purple-600" />
                      <span>视频关键帧提取</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB 2: 版式面板 ===== */}
      {activeTab === 'layouts' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#fafafa]">
          {/* 顶栏：系统版式 与 我的版式 切换 Tabs */}
          <div className="flex border-b border-[#e5e7eb] bg-white px-3 pt-2 shrink-0">
            <button
              id="tab-system-layouts"
              onClick={() => setLayoutSubTab('system')}
              className={`relative pb-2.5 px-3 text-xs font-medium cursor-pointer transition-colors ${
                layoutSubTab === 'system'
                  ? 'text-[#76383d] font-bold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              系统版式
              {layoutSubTab === 'system' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#76383d]" />
              )}
            </button>
            <button
              id="tab-my-layouts"
              onClick={() => setLayoutSubTab('custom')}
              className={`relative pb-2.5 px-3 text-xs font-medium cursor-pointer transition-colors ${
                layoutSubTab === 'custom'
                  ? 'text-[#76383d] font-bold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              我的版式
              {customLayouts.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-[#fdf2f2] text-[#76383d] text-[10px] rounded-full font-normal border border-[#f5c6cb]">
                  {customLayouts.length}
                </span>
              )}
              {layoutSubTab === 'custom' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#76383d]" />
              )}
            </button>
          </div>

          {/* 操作提示 Toast */}
          {saveToast && (
            <div className="mx-3 mt-2 py-1.5 px-3 bg-[#76383d] text-white text-[11px] rounded shadow flex items-center justify-between animate-fade-in shrink-0">
              <span>{saveToast}</span>
              <Check className="w-3.5 h-3.5 ml-2" />
            </div>
          )}

          {/* 1. 系统版式子视图 */}
          {layoutSubTab === 'system' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-[#e5e7eb] bg-white space-y-2.5 shrink-0">
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-neutral-500">版式分类</span>
                  <div className="relative">
                    <select
                      id="select-mimo-layout-category"
                      value={systemCategory}
                      onChange={(e) => setSystemCategory(e.target.value)}
                      className="w-full text-xs bg-[#f8f9fa] hover:bg-white focus:bg-white border border-[#dadce0] focus:border-[#76383d] text-neutral-800 rounded px-2.5 py-1.5 outline-none cursor-pointer pr-8 appearance-none shadow-2xs font-medium transition-all"
                    >
                      <option value="all">所有版式</option>
                      <option value="spread">跨页版式</option>
                      <option value="text">文字版式</option>
                      <option value="1">单图版式</option>
                      <option value="2">2图版式</option>
                      <option value="3">3图版式</option>
                      <option value="4">4图版式</option>
                      <option value="5plus">5图以上版式</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>

                {systemCategory !== 'spread' && (
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
                    <span className="text-[11px] text-neutral-500">当前应用于:</span>
                    <div className="flex items-center space-x-1 text-[11px]">
                      <button
                        onClick={() => onSelectSide('left')}
                        className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          activeSide === 'left' || !activeSide
                            ? 'bg-[#76383d] text-white border-[#76383d] font-medium shadow-2xs'
                            : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        左页(P{currentPageNumber.left})
                      </button>
                      <button
                        onClick={() => onSelectSide('right')}
                        className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                          activeSide === 'right'
                            ? 'bg-[#76383d] text-white border-[#76383d] font-medium shadow-2xs'
                            : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        右页(P{currentPageNumber.right})
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 版式网格列表 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {(systemCategory === 'all' || systemCategory === 'spread') && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
                      <span>跨页大片版式</span>
                      <span className="text-[10px] text-neutral-400 font-normal">双页连贯</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {PRESET_SPREAD_LAYOUTS[0]?.layouts.map((layout) => (
                        <button
                          key={layout.id}
                          onClick={() => {
                            if (layout.spreadSlots) {
                              onApplySpreadLayout(
                                layout.spreadSlots.left,
                                layout.spreadSlots.right
                              );
                            }
                          }}
                          className="group p-2 bg-white border border-[#dadce0] hover:border-[#76383d] rounded text-left transition-all hover:shadow-sm cursor-pointer flex flex-col space-y-1.5"
                        >
                          <div className="w-full aspect-[2/1] bg-[#f1f3f4] rounded border border-neutral-200 relative overflow-hidden flex">
                            <div className="w-1/2 h-full relative border-r border-dashed border-neutral-300">
                              {layout.spreadSlots?.left.map((s) => (
                                <div
                                  key={s.id}
                                  style={{
                                    left: `${s.x}%`,
                                    top: `${s.y}%`,
                                    width: `${s.width}%`,
                                    height: `${s.height}%`,
                                  }}
                                  className="absolute bg-[#d6d8dc] border border-neutral-300 flex items-center justify-center text-[8px] text-neutral-500"
                                >
                                  {s.type === 'text' ? 'T' : '图'}
                                </div>
                              ))}
                            </div>
                            <div className="w-1/2 h-full relative">
                              {layout.spreadSlots?.right.map((s) => (
                                <div
                                  key={s.id}
                                  style={{
                                    left: `${s.x}%`,
                                    top: `${s.y}%`,
                                    width: `${s.width}%`,
                                    height: `${s.height}%`,
                                  }}
                                  className="absolute bg-[#d6d8dc] border border-neutral-300 flex items-center justify-center text-[8px] text-neutral-500"
                                >
                                  {s.type === 'text' ? 'T' : '图'}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-neutral-800 group-hover:text-[#76383d]">
                              {layout.name}
                            </span>
                            <span className="text-[10px] text-neutral-400">跨页通铺</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {PRESET_LAYOUT_CATEGORIES.filter((cat) => {
                  if (systemCategory === 'spread') return false;
                  if (systemCategory === 'all') return true;
                  if (systemCategory === 'text') return cat.id === 'text_layouts';
                  if (systemCategory === '1') return cat.id === 'one_photo';
                  if (systemCategory === '2') return cat.id === 'two_photos';
                  if (systemCategory === '3') return cat.id === 'three_photos';
                  if (systemCategory === '4') return cat.id === 'four_photos';
                  if (systemCategory === '5plus') return cat.id === 'five_plus_photos';
                  return true;
                }).map((cat) => (
                  <div key={cat.id} className="space-y-2">
                    <div className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
                      <span>{cat.name}</span>
                      <span className="text-[10px] text-neutral-400 font-normal">
                        {cat.layouts.length} 种设计
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {cat.layouts.map((layout) => (
                        <button
                          key={layout.id}
                          onClick={() => {
                            const target = activeSide || 'left';
                            if (layout.slots) {
                              onApplyLayoutToCurrentPage(layout.slots, target);
                            }
                          }}
                          className="group p-2 bg-white border border-[#dadce0] hover:border-[#76383d] rounded text-left transition-all hover:shadow-sm cursor-pointer flex flex-col items-center"
                        >
                          <div className="w-full aspect-square bg-[#f1f3f4] rounded border border-neutral-200 relative overflow-hidden mb-1.5">
                            {layout.slots?.map((s) => (
                              <div
                                key={s.id}
                                style={{
                                  left: `${s.x}%`,
                                  top: `${s.y}%`,
                                  width: `${s.width}%`,
                                  height: `${s.height}%`,
                                }}
                                className={`absolute border flex items-center justify-center text-[8px] ${
                                  s.type === 'text'
                                    ? 'bg-amber-50/90 border-amber-300 text-amber-700 font-serif'
                                    : 'bg-[#d6d8dc] border-neutral-300 text-neutral-600 font-mono'
                                }`}
                              >
                                {s.type === 'text' ? 'T' : '图'}
                              </div>
                            ))}
                          </div>
                          <span className="text-[11px] font-medium text-neutral-700 truncate w-full text-center group-hover:text-[#76383d]">
                            {layout.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. 我的版式子视图 */}
          {layoutSubTab === 'custom' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-[#e5e7eb] bg-white space-y-2.5 shrink-0">
                {!isSavingCustom ? (
                  <button
                    id="btn-open-save-custom-layout"
                    onClick={() => {
                      const currentSlots = activeSide === 'right' ? currentRightSlots : currentLeftSlots;
                      const count = currentSlots ? currentSlots.length : 0;
                      setCustomNameInput(`我的DIY版式 (${count}框)`);
                      setIsSavingCustom(true);
                    }}
                    className="w-full py-2 px-3 bg-[#76383d] hover:bg-[#632c30] active:bg-[#522125] text-white rounded text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-2xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>保存当前页为我的版式</span>
                  </button>
                ) : (
                  <div className="space-y-2 p-2.5 bg-[#fdf8f8] border border-[#f5c6cb] rounded">
                    <span className="text-[11px] font-medium text-[#76383d]">
                      将当前 {activeSide === 'right' ? `右页(P${currentPageNumber.right})` : `左页(P${currentPageNumber.left})`} 保存为模板：
                    </span>
                    <input
                      type="text"
                      value={customNameInput}
                      onChange={(e) => setCustomNameInput(e.target.value)}
                      placeholder="输入版式名称"
                      className="w-full text-xs px-2.5 py-1.5 bg-white border border-[#dadce0] focus:border-[#76383d] rounded outline-none"
                      autoFocus
                    />
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={handleSaveCurrentAsCustomLayout}
                        className="flex-1 py-1 bg-[#76383d] text-white rounded text-xs font-medium hover:bg-[#632c30] cursor-pointer"
                      >
                        确认保存
                      </button>
                      <button
                        onClick={() => setIsSavingCustom(false)}
                        className="px-2.5 py-1 bg-white border border-neutral-300 text-neutral-600 rounded text-xs hover:bg-neutral-50 cursor-pointer"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[11px]">
                  <span className="text-neutral-500">点击套用至:</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onSelectSide('left')}
                      className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        activeSide === 'left' || !activeSide
                          ? 'bg-[#76383d] text-white border-[#76383d] font-medium'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      左页(P{currentPageNumber.left})
                    </button>
                    <button
                      onClick={() => onSelectSide('right')}
                      className={`px-2 py-0.5 rounded border transition-all cursor-pointer ${
                        activeSide === 'right'
                          ? 'bg-[#76383d] text-white border-[#76383d] font-medium'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      右页(P{currentPageNumber.right})
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {customLayouts.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-[#fdf2f2] border border-[#f5c6cb] flex items-center justify-center text-[#76383d]">
                      <Bookmark className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-700">暂无自定义版式</p>
                      <p className="text-[11px] text-neutral-400 leading-relaxed">
                        在画布上自由调整图片与文字框后，点击上方「保存当前页为我的版式」，即可在其他页面随时一键复用！
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-neutral-700 flex items-center justify-between">
                      <span>我的收藏版式 ({customLayouts.length})</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {customLayouts.map((layout) => (
                        <div
                          key={layout.id}
                          onClick={() => {
                            const target = activeSide || 'left';
                            onApplyLayoutToCurrentPage(layout.slots, target);
                          }}
                          className="group relative p-2 bg-white border border-[#dadce0] hover:border-[#76383d] rounded text-left transition-all hover:shadow-sm cursor-pointer flex flex-col items-center"
                        >
                          <button
                            onClick={(e) => handleDeleteCustomLayout(layout.id, e)}
                            title="删除此版式"
                            className="absolute top-1.5 right-1.5 p-1 bg-white/90 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-full border border-neutral-200 transition-all opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>

                          <div className="w-full aspect-square bg-[#f1f3f4] rounded border border-neutral-200 relative overflow-hidden mb-1.5">
                            {layout.slots.map((s) => (
                              <div
                                key={s.id}
                                style={{
                                  left: `${s.x}%`,
                                  top: `${s.y}%`,
                                  width: `${s.width}%`,
                                  height: `${s.height}%`,
                                }}
                                className={`absolute border flex items-center justify-center text-[8px] ${
                                  s.type === 'text'
                                    ? 'bg-amber-50/90 border-amber-300 text-amber-700 font-serif'
                                    : 'bg-[#d6d8dc] border-neutral-300 text-neutral-600 font-mono'
                                }`}
                              >
                                {s.type === 'text' ? 'T' : '图'}
                              </div>
                            ))}
                          </div>

                          <span className="text-[11px] font-medium text-neutral-700 truncate w-full text-center group-hover:text-[#76383d]">
                            {layout.name}
                          </span>
                          <span className="text-[9px] text-neutral-400 mt-0.5">
                            {layout.slots.length} 个元素框
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 3: 蒙版素材库 ===== */}
      {activeTab === 'masks' && (
        <MasksPanel
          currentSelectedSlot={
            [...(currentLeftSlots || []), ...(currentRightSlots || [])].find(
              (s) => s.id === selectedSlotId
            ) || null
          }
          onApplyMask={(maskId) => {
            if (onApplyMask) {
              onApplyMask(maskId);
            }
          }}
        />
      )}

      {/* ===== TAB 4: 背景面板 ===== */}
      {activeTab === 'backgrounds' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#e5e7eb] bg-white">
            <span className="text-xs font-semibold text-neutral-800">页面背景色与纸张</span>
            <p className="text-[11px] text-neutral-500 mt-1">选择纯净色调赋予画册温润质感</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2">
              {PRESET_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => onApplyBackgroundColor(bg.value, 'both')}
                  className="p-2 bg-white border border-[#dadce0] hover:border-[#76383d] rounded transition-all flex flex-col items-center space-y-1.5 cursor-pointer"
                >
                  <div
                    style={{ backgroundColor: bg.value }}
                    className="w-full aspect-video rounded border border-neutral-200 shadow-2xs"
                  />
                  <span className="text-xs text-neutral-700">{bg.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB 4: 图章面板 ===== */}
      {activeTab === 'elements' && (
        <StampsPanel
          onAddStamp={(stamp) => onAddStamp?.(stamp)}
          activeSide={activeSide}
          onSelectSide={onSelectSide}
          currentPageNumber={currentPageNumber}
        />
      )}

      {/* ===== TAB 5: 设计/主题/导入面板 ===== */}
      {['design', 'themes', 'import'].includes(activeTab || '') && (
        <div className="flex-1 p-4 flex flex-col justify-center items-center text-center space-y-2 text-neutral-500">
          <Sparkles className="w-8 h-8 text-neutral-400" />
          <p className="text-xs font-medium text-neutral-700">精选素材与主题库</p>
          <p className="text-[11px] text-neutral-500">
            支持一键添加文字贴纸、旅行印章与文艺手绘元素，为相册锦上添花。
          </p>
        </div>
      )}

      {/* ================= 浮层与模态框 ================= */}

      {/* 1. 多渠道照片导入模态框 (手机扫码 / 其他作品 / 历史照片 / 百度网盘 / 视频截帧) */}
      <PhotoSourceModal
        isOpen={sourceModalTab !== null}
        initialTab={sourceModalTab || 'mobile'}
        onClose={() => setSourceModalTab(null)}
        onImportPhotos={(newPhotos) => {
          onAddPhotos(newPhotos);
          showToast(`已成功导入 ${newPhotos.length} 张照片`);
        }}
      />

      {/* 2. 单张照片高清大图与 EXIF 详情预览模态框 */}
      <PhotoDetailModal
        photo={previewPhoto}
        isOpen={previewPhoto !== null}
        onClose={() => setPreviewPhoto(null)}
        onFillActiveSlot={onFillActiveSlot}
        hasActiveSlot={!!selectedSlotId}
      />

      {/* 3. 安全删除拦截对话框 (防止误删已排版的照片) */}
      {deleteBlockedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 animate-fade-in">
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-2xl p-5 space-y-4 border border-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-amber-50 rounded-full text-amber-600 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-900">照片正在画册排版中使用</h3>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  照片 <span className="font-semibold text-neutral-800">「{deleteBlockedPhoto.photo.name}」</span> 当前在作品中被引用了{' '}
                  <span className="font-bold text-[#76383d]">{deleteBlockedPhoto.count} 次</span>。
                </p>
                <p className="text-[11px] text-neutral-500 pt-1">
                  为了保证印前画册的完整性，避免页面画框产生空缺，请先在画布中将对应画框删除或替换为其他照片后再移除此资产。
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-100 flex items-center justify-end space-x-2">
              <button
                onClick={() => setDeleteBlockedPhoto(null)}
                className="px-4 py-2 bg-[#76383d] hover:bg-[#632c30] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
