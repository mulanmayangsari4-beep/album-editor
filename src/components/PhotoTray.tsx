import React, { useState, useRef, useEffect } from 'react';
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
  Sparkle,
} from 'lucide-react';
import { UploadedPhoto, SidebarTab, FrameSlot, CustomUserLayout } from '../types/editor';
import {
  PRESET_LAYOUT_CATEGORIES,
  PRESET_SPREAD_LAYOUTS,
  PRESET_BACKGROUNDS,
} from '../data/defaultTemplates';

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
  currentPageNumber: { left: number; right: number };
  currentLeftSlots?: FrameSlot[];
  currentRightSlots?: FrameSlot[];
}

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
  currentPageNumber,
  currentLeftSlots,
  currentRightSlots,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [thumbSize, setThumbSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [hideUsed, setHideUsed] = useState<boolean>(false);
  const [onlyVideo, setOnlyVideo] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'time' | 'name' | 'size'>('time');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  
  // 版式抽屉顶栏：'system' 系统版式 vs 'custom' 我的版式
  const [layoutSubTab, setLayoutSubTab] = useState<'system' | 'custom'>('system');

  // 系统版式分类下拉筛选器 (米莫截图同款)
  const [systemCategory, setSystemCategory] = useState<string>('all');

  // 我的版式存储与管理
  const [customLayouts, setCustomLayouts] = useState<CustomUserLayout[]>(() => {
    try {
      const saved = localStorage.getItem('mimo_custom_user_layouts');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [isSavingCustom, setIsSavingCustom] = useState<boolean>(false);
  const [customNameInput, setCustomNameInput] = useState<string>('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // 保存自定义版式到 localStorage
  const handleSaveCurrentAsCustomLayout = () => {
    const currentSlots = activeSide === 'right' ? currentRightSlots : currentLeftSlots;
    if (!currentSlots || currentSlots.length === 0) {
      setSaveToast('当前页面为空白，无法保存为空版式');
      setTimeout(() => setSaveToast(null), 2500);
      return;
    }

    const layoutName = customNameInput.trim() || `我的版式 ${customLayouts.length + 1}`;

    // 清理照片绑定，保留纯净的插槽几何位置与文本框
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

  // 处理本地照片上传 (FileReader 纯前端无损读取)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotosList: UploadedPhoto[] = [];
    let processedCount = 0;

    const fileList = Array.from(files);
    fileList.forEach((file: File, index: number) => {
      if (!file.type.startsWith('image/')) {
        processedCount++;
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const resultUrl = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          let aspect: 'horizontal' | 'vertical' | 'square' = 'square';
          if (img.naturalWidth > img.naturalHeight * 1.15) {
            aspect = 'horizontal';
          } else if (img.naturalHeight > img.naturalWidth * 1.15) {
            aspect = 'vertical';
          }

          newPhotosList.push({
            id: `photo_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            url: resultUrl,
            thumbUrl: resultUrl,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            fileSize: file.size,
            usedCount: 0,
            aspectRatio: aspect,
            createdAt: Date.now() + index,
          });

          processedCount++;
          if (processedCount === files.length) {
            onAddPhotos(newPhotosList);
          }
        };
        img.src = resultUrl;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
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

  // 过滤并排序照片
  const filteredPhotos = photos
    .filter((p) => {
      if (hideUsed && p.usedCount > 0) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'time') return b.createdAt - a.createdAt;
      if (sortOrder === 'name') return a.name.localeCompare(b.name);
      return b.fileSize - a.fileSize;
    });

  const totalUsedPhotos = photos.filter((p) => p.usedCount > 0).length;

  const handleClearUnused = () => {
    photos.filter((p) => p.usedCount === 0).forEach((p) => onRemovePhoto(p.id));
  };

  if (!activeTab) return null;

  return (
    <div
      id="left-secondary-panel"
      className="w-80 bg-[#f8f9fa] border-r border-[#e0e2e6] flex flex-col justify-between select-none z-10 shrink-0 text-[#202124]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleTrayDrop}
    >
      {/* ===== TAB 1: 照片面板 ===== */}
      {activeTab === 'photos' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 顶部控制栏 (排序、缩略图大小、复选选项) */}
          <div className="p-3 border-b border-[#e5e7eb] space-y-2 bg-[#f8f9fa]">
            <div className="flex items-center justify-between">
              {/* 排序下拉 */}
              <div className="relative">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'time' | 'name' | 'size')}
                  className="text-xs bg-white border border-[#dadce0] text-neutral-700 rounded px-2 py-1 outline-none cursor-pointer pr-6 appearance-none shadow-xs"
                >
                  <option value="time">按上传时间</option>
                  <option value="name">按文件名称</option>
                  <option value="size">按文件大小</option>
                </select>
                <ChevronDown className="w-3 h-3 text-neutral-400 absolute right-1.5 top-2 pointer-events-none" />
              </div>

              {/* 缩略图比例 */}
              <div className="flex items-center space-x-1 text-xs text-neutral-500">
                <span className="text-[11px]">缩略图:</span>
                <button
                  onClick={() => setThumbSize('small')}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    thumbSize === 'small' ? 'bg-[#e0e2e6] text-neutral-900 font-semibold' : 'hover:bg-neutral-200'
                  }`}
                >
                  小
                </button>
                <button
                  onClick={() => setThumbSize('medium')}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    thumbSize === 'medium' ? 'bg-[#e0e2e6] text-neutral-900 font-semibold' : 'hover:bg-neutral-200'
                  }`}
                >
                  中
                </button>
                <button
                  onClick={() => setThumbSize('large')}
                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                    thumbSize === 'large' ? 'bg-[#e0e2e6] text-neutral-900 font-semibold' : 'hover:bg-neutral-200'
                  }`}
                >
                  大
                </button>
              </div>
            </div>

            {/* 筛选勾选框 */}
            <div className="flex items-center justify-between text-[11px] text-neutral-600 pt-1">
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideUsed}
                  onChange={(e) => setHideUsed(e.target.checked)}
                  className="rounded text-neutral-800 focus:ring-0 cursor-pointer"
                />
                <span>隐藏已使用照片</span>
              </label>

              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyVideo}
                  onChange={(e) => setOnlyVideo(e.target.checked)}
                  className="rounded text-neutral-800 focus:ring-0 cursor-pointer"
                />
                <span>只看视频图片</span>
              </label>

              <span className="text-[10px] text-neutral-400">按住CTRL多选</span>
            </div>
          </div>

          {/* 照片流列表区 / 空白引导区 */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredPhotos.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-start text-xs text-neutral-500 space-y-3 px-2 py-8">
                <p className="font-semibold text-neutral-700 text-sm">如何添加照片</p>
                <div className="space-y-1.5 text-neutral-600 leading-relaxed">
                  <p>方法 1：拖拽电脑/手机照片到此处上传</p>
                  <p>方法 2：点击底部红色按钮【+ 添加照片】</p>
                </div>
                <div className="mt-4 p-3 bg-[#f1f3f4] rounded text-[11px] text-neutral-500 border border-[#e0e2e6]">
                  <p className="font-medium text-neutral-700 mb-1">💡 智能提示：</p>
                  <p>支持将照片直接拖入中央双页画板的照片框中，自动适应最佳构图比例。</p>
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
                {filteredPhotos.map((photo) => {
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
                      onClick={() => {
                        if (selectedSlotId) {
                          onFillActiveSlot(photo.id);
                        } else {
                          const next = new Set(selectedPhotoIds);
                          if (next.has(photo.id)) next.delete(photo.id);
                          else next.add(photo.id);
                          setSelectedPhotoIds(next);
                        }
                      }}
                      className={`group relative aspect-square rounded bg-neutral-200 overflow-hidden cursor-grab active:cursor-grabbing border transition-all ${
                        isSelected
                          ? 'border-[#76383d] ring-2 ring-[#76383d]/40 shadow-sm'
                          : 'border-[#dadce0] hover:border-neutral-400 shadow-2xs'
                      }`}
                      title={`${photo.name} (${photo.naturalWidth}x${photo.naturalHeight}px) - 拖拽入画框`}
                    >
                      <img
                        src={photo.thumbUrl}
                        alt={photo.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover select-none pointer-events-none"
                      />

                      {/* 已排版角标 */}
                      {isUsed && (
                        <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                          已用 {photo.usedCount}
                        </div>
                      )}

                      {/* 悬浮快速删除按钮 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemovePhoto(photo.id);
                        }}
                        className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-[#76383d] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                        title="从托盘移除照片"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>

                      {/* 底部尺寸信息 */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-1 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-white truncate font-mono">
                          {photo.naturalWidth}x{photo.naturalHeight}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 底部统计栏与上传照片按钮 (1:1 还原用户参考图) */}
          <div className="p-3 border-t border-[#e0e2e6] bg-white space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span className="text-neutral-700">
                共 {photos.length} 张，已用 {totalUsedPhotos} 张
              </span>
              <div className="space-x-2">
                <button
                  onClick={handleClearUnused}
                  className="text-[#76383d] hover:underline text-[11px] font-medium cursor-pointer"
                >
                  清理未用
                </button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              id="btn-upload-photos-tray"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 bg-[#76383d] hover:bg-[#632c30] active:bg-[#522125] text-white rounded text-xs font-semibold flex items-center justify-center space-x-1 shadow-sm transition-all cursor-pointer tracking-wide"
            >
              <span>+ 添加照片</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== TAB 2: 版式面板 (米莫同款系统版式与我的版式) ===== */}
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

          {/* ===== 1. 系统版式子视图 ===== */}
          {layoutSubTab === 'system' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 分类下拉与应用目标栏 */}
              <div className="p-3 border-b border-[#e5e7eb] bg-white space-y-2.5 shrink-0">
                {/* 米莫截图同款分类下拉框 */}
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

                {/* 单页模式下选择应用目标 */}
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
                {/* 1. 跨页版式 */}
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
                          {/* 双页展开骨架预览 */}
                          <div className="w-full aspect-[2/1] bg-[#f1f3f4] rounded border border-neutral-200 relative overflow-hidden flex">
                            {/* 左半 */}
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
                            {/* 右半 */}
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

                {/* 2. 单页版式（根据下拉分类精准过滤） */}
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
                          {/* 版式骨架预览框 (米莫灰色精细色块) */}
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

          {/* ===== 2. 我的版式子视图 ===== */}
          {layoutSubTab === 'custom' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 顶部：保存当前页为版式 */}
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

                {/* 应用目标选择 */}
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

              {/* 自定义版式列表 */}
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
                          {/* 删除小图标 */}
                          <button
                            onClick={(e) => handleDeleteCustomLayout(layout.id, e)}
                            title="删除此版式"
                            className="absolute top-1.5 right-1.5 p-1 bg-white/90 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-full border border-neutral-200 transition-all opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>

                          {/* 版式骨架预览框 */}
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

      {/* ===== TAB 3: 背景面板 ===== */}
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

      {/* ===== TAB 4: 设计/素材/主题/导入面板 ===== */}
      {['design', 'elements', 'themes', 'import'].includes(activeTab) && (
        <div className="flex-1 p-4 flex flex-col justify-center items-center text-center space-y-2 text-neutral-500">
          <Sparkles className="w-8 h-8 text-neutral-400" />
          <p className="text-xs font-medium text-neutral-700">精选素材库</p>
          <p className="text-[11px] text-neutral-500">
            支持一键添加文字贴纸、旅行印章与文艺手绘元素，为相册锦上添花。
          </p>
        </div>
      )}
    </div>
  );
};

