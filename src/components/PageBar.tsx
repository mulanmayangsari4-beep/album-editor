import React, { useRef } from 'react';
import {
  Sparkles,
  Zap,
  ArrowLeftRight,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Layers,
  FileCode,
} from 'lucide-react';
import { SpreadModel, UploadedPhoto } from '../types/editor';

interface PageBarProps {
  spreads: SpreadModel[];
  currentSpreadIndex: number;
  onSelectSpread: (index: number) => void;
  onAddSpread: (insertAfterIndex?: number) => void;
  onDeleteSpread: (index: number) => void;
  onAutoLayout: () => void;
  onClearAll: () => void;
  onSwapSpreadPagePhotos?: (spreadIndex?: number) => void;
  photos: UploadedPhoto[];
}

export const PageBar: React.FC<PageBarProps> = ({
  spreads,
  currentSpreadIndex,
  onSelectSpread,
  onAddSpread,
  onDeleteSpread,
  onAutoLayout,
  onClearAll,
  onSwapSpreadPagePhotos,
  photos,
}) => {
  const photoMap = new Map<string, UploadedPhoto>(photos.map((p) => [p.id, p]));
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const offset = direction === 'left' ? -300 : 300;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const currentSpread = spreads[currentSpreadIndex] || spreads[0];

  return (
    <footer
      id="bottom-page-manager-bar"
      className="bg-white border-t border-[#e0e2e6] flex flex-col select-none z-20 shrink-0 shadow-[0_-1px_3px_rgba(0,0,0,0.03)]"
    >
      {/* 顶部功能操作条 (1:1 还原截图) */}
      <div className="h-9 px-4 flex items-center justify-between border-b border-[#f1f3f4] text-xs text-[#3c4043] bg-white">
        {/* 左侧操作组：智能排版、快速编辑、调整顺序、一键清空 */}
        <div className="flex items-center space-x-2">
          {/* 酒红智能排版高亮按钮 */}
          <button
            id="btn-auto-layout"
            onClick={onAutoLayout}
            className="px-2.5 py-1 bg-[#76383d] hover:bg-[#632c30] active:bg-[#522125] text-white rounded text-[11px] font-semibold flex items-center space-x-1 shadow-2xs transition-all cursor-pointer"
            title="将未使用的照片一键智能填入所有空白框"
          >
            <Sparkles className="w-3 h-3" />
            <span>智能排版</span>
          </button>

          <button
            className="px-2 py-1 bg-[#f8f9fa] hover:bg-[#f1f3f4] border border-[#dadce0] text-neutral-700 rounded text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <Zap className="w-3 h-3 text-amber-600" />
            <span>快速编辑</span>
          </button>

          <button
            className="px-2 py-1 bg-[#f8f9fa] hover:bg-[#f1f3f4] border border-[#dadce0] text-neutral-700 rounded text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
          >
            <ArrowLeftRight className="w-3 h-3 text-neutral-500" />
            <span>调整顺序</span>
          </button>

          <button
            onClick={onClearAll}
            className="px-2 py-1 bg-[#f8f9fa] hover:bg-[#faf4f5] border border-[#dadce0] hover:border-[#d8b9be] text-neutral-600 hover:text-[#76383d] rounded text-[11px] flex items-center space-x-1 transition-colors cursor-pointer"
            title="清空画册中所有已放入的照片"
          >
            <Trash2 className="w-3 h-3" />
            <span>一键清空作品</span>
          </button>
        </div>

        {/* 中间翻页跳页选择器: < [ 4-5 ] > */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onSelectSpread(Math.max(0, currentSpreadIndex - 1))}
            disabled={currentSpreadIndex === 0}
            className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="上一跨页"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-neutral-600" />
          </button>

          <div className="flex items-center space-x-1 px-2 py-0.5 bg-[#f8f9fa] border border-[#dadce0] rounded text-[11px] font-mono text-neutral-700">
            <span>
              {currentSpread.leftPage.pageNumber === 0 && currentSpread.rightPage.pageNumber === 0
                ? '封面'
                : `${currentSpread.leftPage.pageNumber || 1} - ${currentSpread.rightPage.pageNumber || 2}`}
            </span>
          </div>

          <button
            onClick={() => onSelectSpread(Math.min(spreads.length - 1, currentSpreadIndex + 1))}
            disabled={currentSpreadIndex === spreads.length - 1}
            className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="下一跨页"
          >
            <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
          </button>
        </div>

        {/* 右侧工具：一键套版、PS排版 */}
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-1 text-[11px] text-neutral-600 hover:text-neutral-900 cursor-pointer">
            <Layers className="w-3 h-3 text-neutral-500" />
            <span>一键套版</span>
          </button>
          <button className="flex items-center space-x-1 text-[11px] text-neutral-600 hover:text-neutral-900 cursor-pointer">
            <FileCode className="w-3 h-3 text-neutral-500" />
            <span>PS排版</span>
          </button>
        </div>
      </div>

      {/* 底部缩略图胶卷横向滚动栏 (1:1 还原截图) */}
      <div className="h-24 px-4 py-2 flex items-center space-x-2 relative bg-[#f8f9fa]">
        {/* 左滚动按钮 */}
        <button
          onClick={() => scroll('left')}
          className="p-1 rounded-full bg-white hover:bg-neutral-100 border border-[#dadce0] shadow-xs text-neutral-500 cursor-pointer shrink-0 z-10"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* 缩略图列表 */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-center space-x-2 overflow-x-auto overflow-y-hidden py-1 scrollbar-none"
        >
          {spreads.map((spread, idx) => {
            const isCurrent = idx === currentSpreadIndex;
            return (
              <React.Fragment key={spread.id}>
                <div
                  id={`thumbnail-spread-${spread.id}`}
                  onClick={() => onSelectSpread(idx)}
                  className="flex flex-col items-center shrink-0 cursor-pointer group"
                >
                  {/* 缩略小画板 (带悬停或当前页顶部 ⇄ 左右照片互换轻量按钮) */}
                  <div className="relative">
                    <div
                      className={`w-28 h-14 bg-white rounded-xs overflow-hidden flex border transition-all ${
                        isCurrent
                          ? 'border-[#76383d] ring-2 ring-[#76383d]/30 shadow-xs'
                          : 'border-[#dadce0] hover:border-neutral-400'
                      }`}
                    >
                      {/* 左页 */}
                      <div className="w-1/2 h-full bg-[#f8f9fa] border-r border-[#e0e2e6] relative overflow-hidden">
                        {spread.leftPage.slots.map((s) => {
                          const photo = s.photoId ? photoMap.get(s.photoId) : undefined;
                          return (
                            <div
                              key={s.id}
                              style={{
                                left: `${s.x}%`,
                                top: `${s.y}%`,
                                width: `${s.width}%`,
                                height: `${s.height}%`,
                              }}
                              className="absolute bg-[#e2e3e5] flex items-center justify-center overflow-hidden"
                            >
                              {photo && (
                                <img
                                  src={photo.thumbUrl}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* 右页 */}
                      <div className="w-1/2 h-full bg-white relative overflow-hidden">
                        {spread.rightPage.slots.map((s) => {
                          const photo = s.photoId ? photoMap.get(s.photoId) : undefined;
                          return (
                            <div
                              key={s.id}
                              style={{
                                left: `${s.x}%`,
                                top: `${s.y}%`,
                                width: `${s.width}%`,
                                height: `${s.height}%`,
                              }}
                              className="absolute bg-[#e2e3e5] flex items-center justify-center overflow-hidden"
                            >
                              {photo && (
                                <img
                                  src={photo.thumbUrl}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 缩略图正中缝悬浮的 ⇄ 左右照片互换极细轻奢微按钮 (仅在鼠标悬停时呈现) */}
                    {onSwapSpreadPagePhotos && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSpread(idx);
                          onSwapSpreadPagePhotos(idx);
                        }}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 transition-all duration-200 z-30 bg-white/90 hover:bg-white text-[#76383d] hover:text-[#5a282d] p-1 rounded-full border border-neutral-200/80 shadow-xs cursor-pointer flex items-center justify-center backdrop-blur-xs"
                        title="左右版面照片互换"
                      >
                        <ArrowLeftRight className="w-2.5 h-2.5" strokeWidth={1.25} />
                      </button>
                    )}
                  </div>

                  {/* 缩略图底部页码标签 */}
                  <span
                    className={`text-[10px] mt-0.5 font-mono ${
                      isCurrent ? 'text-[#76383d] font-semibold' : 'text-neutral-500'
                    }`}
                  >
                    {spread.type === 'cover'
                      ? '封面'
                      : spread.leftPage.pageNumber === 0
                      ? '1'
                      : `${spread.leftPage.pageNumber}-${spread.rightPage.pageNumber}`}
                  </span>
                </div>

                {/* 缩略图之间的轻量添加跨页按钮 + */}
                <button
                  onClick={() => onAddSpread(idx)}
                  className="w-4 h-4 rounded-full border border-dashed border-[#dadce0] hover:border-[#76383d] bg-white hover:bg-[#faf4f5] text-neutral-400 hover:text-[#76383d] flex items-center justify-center text-[10px] shrink-0 transition-colors cursor-pointer"
                  title="在此处插入一个新跨页"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* 右滚动按钮 */}
        <button
          onClick={() => scroll('right')}
          className="p-1 rounded-full bg-white hover:bg-neutral-100 border border-[#dadce0] shadow-xs text-neutral-500 cursor-pointer shrink-0 z-10"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  );
};
