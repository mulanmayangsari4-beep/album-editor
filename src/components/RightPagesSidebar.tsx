import React, { useState, useRef, useEffect } from 'react';
import {
  Square,
  Plus,
  Trash2,
  Copy,
  ArrowLeftRight,
  PanelRightOpen,
  Layers,
} from 'lucide-react';
import { SpreadModel, UploadedPhoto, BookSpec } from '../types/editor';
import { IconMultiPageGrid } from './MultiPageEditorModal';
import { getMomoMaskStyle } from '../utils/masks';

interface RightPagesSidebarProps {
  spreads: SpreadModel[];
  currentSpreadIndex: number;
  onSelectSpread: (index: number) => void;
  onAddSpread: (insertAfterIndex?: number) => void;
  onDeleteSpread: (index: number) => void;
  onAutoLayout: () => void;
  onClearAll: () => void;
  onSwapSpreadPagePhotos?: (spreadIndex?: number) => void;
  onOpenMultiPage?: () => void;
  photos: UploadedPhoto[];
  bookSpec: BookSpec;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const RightPagesSidebar: React.FC<RightPagesSidebarProps> = ({
  spreads,
  currentSpreadIndex,
  onSelectSpread,
  onAddSpread,
  onDeleteSpread,
  onAutoLayout,
  onClearAll,
  onSwapSpreadPagePhotos,
  onOpenMultiPage,
  photos,
  bookSpec,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const photoMap = new Map<string, UploadedPhoto>(photos.map((p) => [p.id, p]));
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 自动滚动并高亮居中定位当前选中的跨页
  useEffect(() => {
    if (!isCollapsed) {
      const el = itemRefs.current[currentSpreadIndex];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentSpreadIndex, isCollapsed]);

  const currentSpread = spreads[currentSpreadIndex] || spreads[0];

  // 渲染单个页面 (左页或右页) 内部的缩略相框 (1:1 精确同步主设计区的裁切、缩放与排版)
  const renderMiniPage = (
    pageSlots: typeof spreads[0]['leftPage']['slots'],
    bgColor: string = '#ffffff',
    isFrontInsideBlank: boolean = false
  ) => {
    if (isFrontInsideBlank) {
      return (
        <div className="w-full h-full bg-[#fafafa] flex flex-col items-center justify-center p-1.5 text-center select-none border-r border-neutral-100">
          <span className="text-[6.5px] font-sans font-medium text-neutral-400/80 leading-tight uppercase tracking-tight scale-90">
            THIS PAGE<br />INTENTIONALLY<br />LEFT BLANK
          </span>
        </div>
      );
    }

    return (
      <div
        className="w-full h-full relative overflow-hidden"
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
                  <span className="text-[5px] text-neutral-800 font-sans truncate px-0.5 leading-none">
                    {slot.text}
                  </span>
                ) : (
                  <div className="w-full h-full border border-dashed border-neutral-300/80 bg-neutral-50/40 flex items-center justify-center">
                    <span className="text-[4.5px] text-neutral-400 scale-75 whitespace-nowrap">
                      文字
                    </span>
                  </div>
                )}
              </div>
            );
          }

          const crop = slot.crop || { x: 50, y: 50, scale: 1.0, rotation: 0 };
          const activeScale = crop.scale || 1.0;

          return (
            <div
              key={slot.id}
              className={`absolute overflow-hidden ${photo ? 'bg-transparent' : 'bg-[#e2e3e5]'} border-[0.5px] border-black/5`}
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.width}%`,
                height: `${slot.height}%`,
                transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
                borderRadius:
                  slot.maskShape && slot.maskShape !== 'none'
                    ? undefined
                    : slot.borderRadius
                    ? `${slot.borderRadius * 0.25}px`
                    : undefined,
                ...getMomoMaskStyle(slot.maskShape),
              }}
            >
              {photo ? (
                <div
                  className="w-full h-full relative overflow-hidden flex items-center justify-center"
                  style={{
                    transform: `scale(${activeScale}) rotate(${crop.rotation || 0}deg)`,
                  }}
                >
                  <img
                    src={photo.previewUrl || photo.thumbnailUrl || photo.thumbUrl || photo.url}
                    alt=""
                    className="w-full h-full object-cover select-none pointer-events-none"
                    referrerPolicy="no-referrer"
                    style={{
                      objectPosition: `${crop.x}% ${crop.y}%`,
                      transform: `translate(${(50 - crop.x) * (activeScale - 1) * 0.5}%, ${(50 - crop.y) * (activeScale - 1) * 0.5}%)`,
                    }}
                  />
                </div>
              ) : (
                <div className="w-full h-full bg-[#f0f1f3] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-neutral-300/80" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 折叠状态下右侧仅显示精致的立式图标条
  if (isCollapsed) {
    return (
      <aside
        id="right-pages-sidebar-collapsed"
        className="w-10 bg-white border-l border-[#e2e4e8] flex flex-col items-center py-3 select-none shrink-0 z-20 shadow-[-1px_0_3px_rgba(0,0,0,0.03)] justify-between"
      >
        <div className="flex flex-col items-center space-y-4">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
            title="展开右侧页面列表"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>

          {/* 展开多页总览 (图邦主模式) */}
          {onOpenMultiPage && (
            <button
              onClick={onOpenMultiPage}
              className="p-1.5 rounded-md bg-[#76383d] text-white hover:bg-[#632c30] shadow-xs transition-transform hover:scale-105 cursor-pointer"
              title="打开多页编辑与总览 (图邦主模式)"
            >
              <IconMultiPageGrid className="w-3.5 h-3.5" />
            </button>
          )}

          <div
            onClick={onToggleCollapse}
            className="flex flex-col items-center space-y-1 cursor-pointer group py-2"
            title="展开页面列表"
          >
            <span className="text-[11px] font-semibold text-neutral-700 writing-mode-vertical group-hover:text-purple-700 tracking-wider">
              页面大纲
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {spreads.length}
            </span>
          </div>
        </div>

        {/* 折叠栏底部多页入口 */}
        {onOpenMultiPage && (
          <button
            onClick={onOpenMultiPage}
            className="p-1.5 rounded-md bg-[#76383d] text-white hover:bg-[#632c30] shadow-xs transition-transform hover:scale-105 cursor-pointer"
            title="打开全书多页平铺编辑"
          >
            <IconMultiPageGrid className="w-3.5 h-3.5" />
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside
      id="right-pages-sidebar"
      className="w-72 bg-[#f8f9fa] border-l border-[#e2e4e8] flex flex-col h-full select-none z-20 shrink-0 shadow-[-2px_0_6px_rgba(0,0,0,0.03)]"
    >
      {/* 顶部标题与视图控制栏：单页预览在前，全书多页平铺在后 */}
      <div className="h-11 px-3 bg-white border-b border-[#e5e7eb] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-neutral-800 tracking-tight">全部页面</span>
          <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full">
            共 {spreads.length} 跨页
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* 单页大图预览 (放在前面) */}
          <div
            className="w-7 h-7 rounded-md bg-[#f0f2f5] border border-[#dadce0] flex items-center justify-center text-neutral-700 shadow-2xs"
            title="单页大图列表"
          >
            <Square className="w-3.5 h-3.5 fill-current text-neutral-600" />
          </div>

          {/* 全书多页平铺 (放在后面) */}
          {onOpenMultiPage && (
            <button
              onClick={onOpenMultiPage}
              className="p-1.5 rounded-md bg-[#76383d] text-white hover:bg-[#632c30] shadow-xs transition-transform hover:scale-105 cursor-pointer"
              title="打开全书多页平铺编辑"
            >
              <IconMultiPageGrid className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 辅助操作栏：加跨页、左右对调、一键清空 (已按要求拿掉「智能排版」与「页码按钮」) */}
      <div className="px-3 py-2 bg-white border-b border-[#e5e7eb] flex items-center justify-between text-[11px] text-neutral-600 shrink-0 shadow-2xs">
        <button
          onClick={() => onAddSpread(currentSpreadIndex)}
          className="flex items-center space-x-1 px-2 py-1 hover:bg-neutral-100 text-blue-600 font-medium rounded transition-colors cursor-pointer"
          title="在此跨页后插入新跨页"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>加跨页</span>
        </button>

        <button
          onClick={() => onSwapSpreadPagePhotos?.(currentSpreadIndex)}
          className="flex items-center space-x-1 px-2 py-1 hover:bg-neutral-100 text-neutral-600 rounded transition-colors cursor-pointer"
          title="左右页照片互换"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-neutral-400" />
          <span>左右对调</span>
        </button>

        <button
          onClick={onClearAll}
          className="flex items-center space-x-1 px-2 py-1 hover:bg-red-50 text-neutral-500 hover:text-red-600 rounded transition-colors cursor-pointer"
          title="清空全书已填照片"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>一键清空</span>
        </button>
      </div>

      {/* 纵向页面滚动列表 (1:1 还原用户参考截图) */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 scrollbar-thin scrollbar-thumb-neutral-300 space-y-4.5"
      >
        {spreads.map((spread, idx) => {
          const isCurrent = idx === currentSpreadIndex;
          const isCover = spread.isCover || (spread.leftPage.pageNumber === 0 && spread.rightPage.pageNumber === 0);

          return (
            <div
              key={spread.id}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              onClick={() => onSelectSpread(idx)}
              className="group flex flex-col items-center cursor-pointer transition-all relative"
            >
              {/* 跨页立体卡片外框 */}
              <div
                className={`w-full relative transition-all rounded-[3px] bg-neutral-200/60 p-[3px] ${
                  isCurrent
                    ? 'ring-2 ring-[#76383d] shadow-md scale-[1.01]'
                    : 'hover:ring-1 hover:ring-neutral-400/80 hover:shadow-xs'
                }`}
              >
                {/* 封面特殊形态 (单页靠右展示，左边留空，带真实书脊阴影) */}
                {isCover ? (
                  <div className="w-full flex justify-end items-center bg-transparent py-0.5">
                    <div className="w-1/2 aspect-[1/1] bg-white rounded-r-[2px] shadow-[0_3px_8px_rgba(0,0,0,0.18)] border border-neutral-200 relative overflow-hidden">
                      {/* 左侧折痕与书脊立体渐变 */}
                      <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/25 via-black/5 to-transparent z-10 pointer-events-none" />
                      {renderMiniPage(
                        spread.rightPage.slots.length > 0 ? spread.rightPage.slots : spread.leftPage.slots,
                        spread.rightPage.backgroundColor
                      )}
                    </div>
                  </div>
                ) : (
                  /* 标准双跨页形态 (左右展开，带立体中缝折痕与阴影) */
                  <div className="w-full aspect-[2/1] bg-white rounded-[2px] shadow-[0_2px_6px_rgba(0,0,0,0.12)] border border-neutral-200 flex relative overflow-hidden">
                    {/* 左页 */}
                    <div className="w-1/2 h-full relative border-r border-neutral-100 overflow-hidden">
                      {idx === 1 ? (
                        renderMiniPage(spread.leftPage.slots, spread.leftPage.backgroundColor, true)
                      ) : (
                        renderMiniPage(spread.leftPage.slots, spread.leftPage.backgroundColor)
                      )}
                    </div>

                    {/* 右页 */}
                    <div className="w-1/2 h-full relative overflow-hidden">
                      {renderMiniPage(spread.rightPage.slots, spread.rightPage.backgroundColor)}
                    </div>

                    {/* 中缝立体阴影折痕 */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-4 bg-gradient-to-r from-transparent via-black/15 to-transparent pointer-events-none z-10" />
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[0.5px] bg-black/20 pointer-events-none z-10" />
                  </div>
                )}

                {/* 悬浮快捷小操作：加页、删页 */}
                <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center space-x-1 z-20">
                  {spreads.length > 2 && !isCover && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSpread(idx);
                      }}
                      className="p-1 rounded bg-white/95 text-neutral-500 hover:text-red-600 shadow-sm border border-neutral-200 transition-colors"
                      title="删除此跨页"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSpread(idx);
                    }}
                    className="p-1 rounded bg-white/95 text-neutral-600 hover:text-blue-600 shadow-sm border border-neutral-200 transition-colors"
                    title="在下方插入新跨页"
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

              {/* 下方页码标注 (严格复刻截图) */}
              <div className="w-full mt-1.5 flex items-center justify-between px-1 text-[11px] font-sans font-medium text-neutral-700 tracking-tight">
                {isCover ? (
                  <div className="w-full text-center text-[10.5px] font-semibold text-neutral-800 uppercase">
                    FRONT COVER
                  </div>
                ) : idx === 1 ? (
                  <div className="w-full flex items-center justify-between">
                    <span className="w-1/2 text-center text-[9.5px] text-neutral-500 uppercase tracking-tighter">
                      FRONT INSIDE
                    </span>
                    <span className="w-1/2 text-center font-semibold text-neutral-800">1</span>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-between">
                    <span className="w-1/2 text-center font-medium text-neutral-700">{spread.leftPage.pageNumber}</span>
                    <span className="w-1/2 text-center font-medium text-neutral-700">{spread.rightPage.pageNumber}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
