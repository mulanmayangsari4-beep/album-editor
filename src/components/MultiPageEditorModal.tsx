import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  ArrowLeftRight,
  Maximize2,
  Check,
  GripVertical,
  Layers,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
} from 'lucide-react';
import { SpreadModel, UploadedPhoto, BookSpec } from '../types/editor';

interface MultiPageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreads: SpreadModel[];
  currentSpreadIndex: number;
  onSelectSpread: (index: number) => void;
  onAddSpread: (insertAfterIndex?: number) => void;
  onDeleteSpread: (index: number) => void;
  onDuplicateSpread?: (index: number) => void;
  onReorderSpreads?: (fromIndex: number, toIndex: number) => void;
  onSwapSpreadPagePhotos?: (spreadIndex: number) => void;
  onAutoLayout: () => void;
  onClearAll: () => void;
  photos: UploadedPhoto[];
  bookSpec: BookSpec;
}

// 1:1 精确复刻图 1 中的多页编辑主图标 (圆角矩形 + 四角括号 + 四点/四格)
export const IconMultiPageGrid: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 四个对齐的定位角括号 */}
    <path
      d="M4.5 7.5V5.5C4.5 4.94772 4.94772 4.5 5.5 4.5H7.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.5 4.5H14.5C15.0523 4.5 15.5 4.94772 15.5 5.5V7.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.5 12.5V14.5C15.5 15.0523 15.0523 15.5 14.5 15.5H12.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.5 15.5H5.5C4.94772 15.5 4.5 15.0523 4.5 14.5V12.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* 中心 4 个精致的小方块 / 格点 */}
    <rect x="7" y="7" width="2" height="2" rx="0.5" fill="currentColor" />
    <rect x="11" y="7" width="2" height="2" rx="0.5" fill="currentColor" />
    <rect x="7" y="11" width="2" height="2" rx="0.5" fill="currentColor" />
    <rect x="11" y="11" width="2" height="2" rx="0.5" fill="currentColor" />
  </svg>
);

const getMaskStyle = (maskShape?: string): React.CSSProperties => {
  if (!maskShape || maskShape === 'none') return {};
  switch (maskShape) {
    case 'circle':
      return { clipPath: 'circle(50% at 50% 50%)' };
    case 'heart':
      return {
        clipPath:
          'polygon(50% 15%, 62% 0%, 82% 0%, 100% 18%, 100% 40%, 50% 95%, 0% 40%, 0% 18%, 18% 0%, 38% 0%)',
      };
    case 'star':
      return {
        clipPath:
          'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
      };
    case 'diamond':
      return { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' };
    case 'triangle':
      return { clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' };
    case 'hexagon':
      return { clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' };
    case 'arch':
      return { borderRadius: '1000px 1000px 0 0' };
    default:
      return {};
  }
};

export const MultiPageEditorModal: React.FC<MultiPageEditorModalProps> = ({
  isOpen,
  onClose,
  spreads,
  currentSpreadIndex,
  onSelectSpread,
  onAddSpread,
  onDeleteSpread,
  onDuplicateSpread,
  onReorderSpreads,
  onSwapSpreadPagePhotos,
  onAutoLayout,
  onClearAll,
  photos,
  bookSpec,
}) => {
  const photoMap = useMemo(() => new Map<string, UploadedPhoto>(photos.map((p) => [p.id, p])), [photos]);

  // 列数与缩放模式：3列 / 4列 / 5列 (默认 5 列，与图 2 完全一致)
  const [columns, setColumns] = useState<3 | 4 | 5>(5);

  // 拖拽排序状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // 统计全部未填满相框数
  const totalUnfilledSlots = useMemo(() => {
    let count = 0;
    spreads.forEach((spread) => {
      spread.leftPage.slots.forEach((s) => {
        if (s.type === 'photo' && !s.photoId) count++;
      });
      spread.rightPage.slots.forEach((s) => {
        if (s.type === 'photo' && !s.photoId) count++;
      });
    });
    return count;
  }, [spreads]);

  if (!isOpen) return null;

  // 渲染单页微型画布内容
  const renderPageMini = (
    pageSlots: typeof spreads[0]['leftPage']['slots'],
    bgColor: string = '#ffffff',
    isFrontInsideBlank: boolean = false
  ) => {
    if (isFrontInsideBlank) {
      return (
        <div className="w-full h-full bg-[#fbfbfb] flex flex-col items-center justify-center p-2 text-center select-none border-r border-neutral-200/60">
          <span className="text-[7px] font-sans font-medium text-neutral-300 leading-tight uppercase tracking-wider scale-90">
            BLANK PAGE
          </span>
        </div>
      );
    }

    return (
      <div
        className="w-full h-full relative overflow-hidden select-none"
        style={{ backgroundColor: bgColor || '#ffffff' }}
      >
        {pageSlots.map((slot) => {
          const photo = slot.photoId ? photoMap.get(slot.photoId) : undefined;
          const isText = slot.type === 'text';

          if (isText) {
            return (
              <div
                key={slot.id}
                className="absolute flex items-center justify-center overflow-hidden"
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.width}%`,
                  height: `${slot.height}%`,
                  transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
                }}
              >
                {slot.text ? (
                  <span
                    className="text-[6px] text-neutral-800 font-sans truncate px-0.5 leading-none"
                    style={{
                      fontFamily: slot.fontFamily,
                      color: slot.color || '#202124',
                    }}
                  >
                    {slot.text}
                  </span>
                ) : (
                  <div className="w-full h-full border border-dashed border-neutral-300/80 bg-neutral-50/50 flex items-center justify-center">
                    <span className="text-[5.5px] text-neutral-400 scale-90 whitespace-nowrap">
                      点两次输入文字
                    </span>
                  </div>
                )}
              </div>
            );
          }

          const crop = slot.crop || { x: 50, y: 50, scale: 1.0, rotation: 0 };
          const activeScale = crop.scale || 1.0;
          const hasBorder = !!(slot.borderWidth && slot.borderWidth > 0);

          return (
            <div
              key={slot.id}
              className="absolute overflow-hidden bg-[#e9ebed]"
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.width}%`,
                height: `${slot.height}%`,
                opacity: slot.opacity !== undefined ? slot.opacity : 1,
                transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
                borderRadius:
                  slot.maskShape && slot.maskShape !== 'none'
                    ? undefined
                    : slot.borderRadius
                    ? `${slot.borderRadius * 0.4}px`
                    : undefined,
                border: hasBorder
                  ? `${Math.max(1, (slot.borderWidth || 0) * 0.4)}px solid ${slot.borderColor || '#ffffff'}`
                  : undefined,
                ...getMaskStyle(slot.maskShape),
              }}
            >
              {photo ? (
                <div
                  className="w-full h-full relative overflow-hidden flex items-center justify-center"
                  style={{
                    transform: `scale(${activeScale}) rotate(${crop.rotation || 0}deg) ${slot.flipH ? 'scaleX(-1)' : ''}`,
                  }}
                >
                  <img
                    src={photo.previewUrl || photo.thumbnailUrl || photo.thumbUrl || photo.url}
                    alt=""
                    className={`w-full h-full ${slot.fitMode === 'contain' ? 'object-contain' : 'object-cover'} select-none pointer-events-none`}
                    referrerPolicy="no-referrer"
                    style={{
                      objectPosition: slot.fitMode === 'contain' ? 'center' : `${crop.x}% ${crop.y}%`,
                      transform:
                        slot.fitMode === 'contain'
                          ? undefined
                          : `translate(${(50 - crop.x) * (activeScale - 1) * 0.5}%, ${(50 - crop.y) * (activeScale - 1) * 0.5}%)`,
                    }}
                  />
                </div>
              ) : (
                <div className="w-full h-full bg-[#f3f4f6] flex flex-col items-center justify-center border border-dashed border-neutral-300/80 p-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-neutral-300/60 mb-0.5" />
                  <span className="text-[5px] text-neutral-400 leading-none scale-75 whitespace-nowrap">
                    拖拽照片至此添加
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 计算单个跨页未填满相框数
  const getSpreadUnfilledCount = (spread: SpreadModel) => {
    let count = 0;
    spread.leftPage.slots.forEach((s) => {
      if (s.type === 'photo' && !s.photoId) count++;
    });
    spread.rightPage.slots.forEach((s) => {
      if (s.type === 'photo' && !s.photoId) count++;
    });
    return count;
  };

  // 格式化页码字符串 (01, 02, 封底, 封面)
  const formatPageLabel = (pageNumber: number, isLeft: boolean, isCover: boolean) => {
    if (isCover) {
      return isLeft ? '封底' : '封面';
    }
    if (pageNumber === 0) {
      return isLeft ? '衬纸' : '01';
    }
    return pageNumber < 10 ? `0${pageNumber}` : `${pageNumber}`;
  };

  return (
    <div
      id="multi-page-editor-overlay"
      className="fixed inset-0 z-[150] bg-[#eef0f3] flex flex-col select-none overflow-hidden animate-fade-in"
    >
      {/* 顶部深灰/白色专业操作栏 */}
      <header className="h-14 px-6 bg-white border-b border-[#dadce0] flex items-center justify-between shadow-xs shrink-0 z-20">
        {/* 左侧：标题、跨页总数、未填照片徽章 */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-[#76383d] text-white px-2.5 py-1.5 rounded-lg shadow-xs">
            <IconMultiPageGrid className="w-4 h-4 text-white" />
            <span className="text-xs font-bold tracking-wide">多页编辑模式</span>
          </div>

          <span className="text-xs font-semibold text-neutral-600">
            共 {spreads.length} 跨页 ({spreads.length * 2} 页)
          </span>

          {totalUnfilledSlots > 0 ? (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>全书剩余 {totalUnfilledSlots} 个相框未填</span>
            </span>
          ) : (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center space-x-1">
              <Check className="w-3 h-3 text-emerald-600" />
              <span>所有相框已全部填满</span>
            </span>
          )}
        </div>

        {/* 中间快捷操作组：智能排版、一键清空、添加跨页、列数视图切换 */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={onAutoLayout}
            className="px-3.5 py-1.5 bg-[#76383d] hover:bg-[#632c30] active:bg-[#522125] text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer hover:scale-102"
            title="一键智能将照片填满所有空相框"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>智能排版 (自动填满)</span>
          </button>

          <button
            onClick={() => onAddSpread()}
            className="px-3 py-1.5 bg-white hover:bg-neutral-50 active:bg-neutral-100 border border-[#dadce0] text-neutral-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="在画册末尾添加新跨页"
          >
            <Plus className="w-3.5 h-3.5 text-neutral-600" />
            <span>添加跨页</span>
          </button>

          <button
            onClick={onClearAll}
            className="px-3 py-1.5 bg-white hover:bg-[#faf4f5] active:bg-[#f5e6e8] border border-[#dadce0] hover:border-[#d8b9be] text-neutral-600 hover:text-[#76383d] rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="一键清空所有照片"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>一键清空</span>
          </button>

          <div className="w-[1px] h-6 bg-neutral-200 mx-1" />

          {/* 列数切换 */}
          <div className="flex items-center space-x-0.5 bg-[#f0f2f5] p-1 rounded-lg border border-[#dadce0]">
            <button
              onClick={() => setColumns(3)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all cursor-pointer ${
                columns === 3 ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              3 列大图
            </button>
            <button
              onClick={() => setColumns(4)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all cursor-pointer ${
                columns === 4 ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              4 列
            </button>
            <button
              onClick={() => setColumns(5)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-all cursor-pointer ${
                columns === 5 ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              5 列 (标准)
            </button>
          </div>
        </div>

        {/* 右侧：完成 / 返回单页编辑按钮 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 transition-all cursor-pointer hover:shadow-md"
          >
            <Check className="w-4 h-4" />
            <span>完成并返回设计</span>
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
            title="关闭多页视图 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 主体多页平铺网格区 (1:1 复刻图 2 图邦主风格) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-8 scrollbar-thin scrollbar-thumb-neutral-300">
        <div
          className={`grid gap-x-3 gap-y-10 items-start max-w-[1920px] mx-auto ${
            columns === 3
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : columns === 4
              ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
          }`}
        >
          {spreads.map((spread, index) => {
            const isSelected = currentSpreadIndex === index;
            const unfilledCount = getSpreadUnfilledCount(spread);
            const isCover = spread.isCover || index === 0;

            const isDraggingThis = draggedIndex === index;
            const isOverThis = dragOverIndex === index;

            return (
              <React.Fragment key={spread.id || index}>
                {/* 跨页单元容器 */}
                <div
                  className={`flex flex-col relative group transition-all duration-200 ${
                    isDraggingThis ? 'opacity-40 scale-95' : ''
                  }`}
                  draggable
                  onDragStart={(e) => {
                    setDraggedIndex(index);
                    e.dataTransfer.setData('text/plain', String(index));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverIndex !== index) {
                      setDragOverIndex(index);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === index) setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex !== null && draggedIndex !== index) {
                      onReorderSpreads?.(draggedIndex, index);
                    }
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                >
                  {/* 拖拽指示线 */}
                  {isOverThis && draggedIndex !== index && (
                    <div className="absolute -left-2 top-0 bottom-6 w-1 bg-[#2563eb] rounded-full z-40 animate-pulse" />
                  )}

                  {/* 跨页画框主体卡片 */}
                  <div
                    onClick={() => onSelectSpread(index)}
                    onDoubleClick={() => {
                      onSelectSpread(index);
                      onClose();
                    }}
                    className={`relative w-full aspect-[2/1] bg-white rounded-[2px] cursor-pointer transition-all duration-150 flex shadow-[0_2px_10px_rgba(0,0,0,0.06)] overflow-hidden ${
                      isSelected
                        ? 'ring-[2.5px] ring-[#1e40af] border-transparent shadow-[0_4px_20px_rgba(30,64,175,0.22)]'
                        : 'border border-neutral-300/80 hover:shadow-lg hover:border-neutral-400'
                    }`}
                  >
                    {/* 顶部中央气泡徽章：剩余 X 张未填 (1:1 还原图 2 样式) */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                      {unfilledCount > 0 ? (
                        <div className="bg-neutral-800/80 backdrop-blur-[2px] text-white text-[10px] font-normal px-2.5 py-0.5 rounded-full shadow-md border border-white/20 whitespace-nowrap tracking-tight scale-90">
                          剩余 {unfilledCount} 张未填
                        </div>
                      ) : (
                        <div className="bg-emerald-800/80 backdrop-blur-[2px] text-white text-[10px] font-normal px-2 py-0.5 rounded-full shadow-md border border-white/20 whitespace-nowrap tracking-tight scale-90 opacity-0 group-hover:opacity-100 transition-opacity">
                          已填满
                        </div>
                      )}
                    </div>

                    {/* 左半页 */}
                    <div className="w-1/2 h-full relative overflow-hidden border-r border-neutral-200/90">
                      {renderPageMini(
                        spread.leftPage.slots,
                        spread.leftPage.backgroundColor,
                        index === 1 && spread.leftPage.pageNumber === 0
                      )}
                    </div>

                    {/* 右半页 */}
                    <div className="w-1/2 h-full relative overflow-hidden">
                      {renderPageMini(spread.rightPage.slots, spread.rightPage.backgroundColor, false)}
                    </div>

                    {/* 悬停操作浮层按钮组 (右上角快速操作) */}
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                      <div className="flex items-center space-x-1.5 p-1 bg-white/95 backdrop-blur-xs rounded-lg shadow-xl pointer-events-auto border border-neutral-200 scale-90">
                        {/* 设为当前编辑跨页 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSpread(index);
                            onClose();
                          }}
                          className="px-2 py-1 bg-[#2563eb] text-white rounded text-[10px] font-medium flex items-center space-x-1 hover:bg-[#1d4ed8] cursor-pointer"
                          title="进入此跨页设计编辑"
                        >
                          <Maximize2 className="w-3 h-3" />
                          <span>编辑</span>
                        </button>

                        {/* 左右对调照片 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSwapSpreadPagePhotos?.(index);
                          }}
                          className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer"
                          title="左右页照片互换"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>

                        {/* 复制跨页 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateSpread?.(index);
                          }}
                          className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded cursor-pointer"
                          title="复制此跨页"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {/* 删除跨页 */}
                        <button
                          disabled={spreads.length <= 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSpread(index);
                          }}
                          className={`p-1 rounded cursor-pointer ${
                            spreads.length <= 1
                              ? 'text-neutral-300 cursor-not-allowed'
                              : 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                          }`}
                          title="删除此跨页"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* 拖拽手柄 */}
                        <div
                          className="p-1 text-neutral-400 hover:text-neutral-700 cursor-grab active:cursor-grabbing"
                          title="按住拖拽调整跨页顺序"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 底部页码文字 (1:1 还原图 2 样式：选中有蓝色文字，左页码与右页码居中对齐) */}
                  <div className="flex items-center justify-around w-full mt-2.5 px-2 text-xs select-none">
                    <span
                      className={`font-mono text-center min-w-8 transition-colors ${
                        isSelected ? 'text-[#1e40af] font-bold' : 'text-neutral-600 font-medium'
                      }`}
                    >
                      {formatPageLabel(spread.leftPage.pageNumber, true, isCover)}
                    </span>
                    <span
                      className={`font-mono text-center min-w-8 transition-colors ${
                        isSelected ? 'text-[#1e40af] font-bold' : 'text-neutral-600 font-medium'
                      }`}
                    >
                      {formatPageLabel(spread.rightPage.pageNumber, false, isCover)}
                    </span>
                  </div>
                </div>

                {/* 跨页之间的快捷插入「+」按钮 (1:1 还原图 2 布局) */}
                {index < spreads.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center -mx-2 self-center z-10 my-auto">
                    <button
                      onClick={() => onAddSpread(index)}
                      className="w-5 h-5 rounded-full bg-neutral-200/90 hover:bg-[#76383d] text-neutral-600 hover:text-white flex items-center justify-center transition-all shadow-2xs hover:scale-125 cursor-pointer opacity-40 hover:opacity-100 group/plus"
                      title={`在第 ${index + 1} 跨页后插入新跨页`}
                    >
                      <Plus className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* 末尾添加新跨页大卡片 */}
          <button
            onClick={() => onAddSpread()}
            className="w-full aspect-[2/1] bg-white/60 hover:bg-white rounded-[2px] border-2 border-dashed border-neutral-300 hover:border-[#76383d] flex flex-col items-center justify-center space-y-2 text-neutral-400 hover:text-[#76383d] transition-all cursor-pointer group shadow-2xs hover:shadow-md"
          >
            <div className="w-8 h-8 rounded-full bg-neutral-100 group-hover:bg-[#76383d]/10 flex items-center justify-center transition-colors">
              <Plus className="w-5 h-5 text-neutral-500 group-hover:text-[#76383d]" />
            </div>
            <span className="text-xs font-semibold">添加新跨页</span>
          </button>
        </div>
      </main>
    </div>
  );
};
