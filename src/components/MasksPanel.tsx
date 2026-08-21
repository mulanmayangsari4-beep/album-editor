import React, { useState, useMemo } from 'react';
import {
  Search,
  Check,
  Grid3X3,
  LayoutGrid,
  Info,
  Sparkles,
  Layers,
} from 'lucide-react';
import { MaskShape, FrameSlot } from '../types/editor';
import {
  MOMO_MASK_DEFINITIONS,
  MOMO_MASK_CATEGORIES,
  MaskCategory,
  MaskDefinition,
  normalizePathBoundingBox,
} from '../utils/masks';

interface MasksPanelProps {
  currentSelectedSlot?: FrameSlot | null;
  onApplyMask: (maskId: MaskShape) => void;
  onAddMaskedFrame?: (maskId: MaskShape) => void;
}

export const MasksPanel: React.FC<MasksPanelProps> = ({
  currentSelectedSlot,
  onApplyMask,
  onAddMaskedFrame,
}) => {
  const [activeCategory, setActiveCategory] = useState<MaskCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gridCols, setGridCols] = useState<3 | 4>(3);

  // 过滤后的蒙版列表
  const filteredMasks = useMemo(() => {
    return MOMO_MASK_DEFINITIONS.filter((mask) => {
      // 分类筛选
      if (activeCategory !== 'all' && mask.category !== activeCategory) {
        return false;
      }
      // 搜索词匹配
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return mask.name.toLowerCase().includes(q) || mask.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [activeCategory, searchQuery]);

  // 计算每个分类的蒙版数量
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: MOMO_MASK_DEFINITIONS.length };
    MOMO_MASK_DEFINITIONS.forEach((m) => {
      if (m.category) {
        counts[m.category] = (counts[m.category] || 0) + 1;
      }
    });
    return counts;
  }, []);

  const currentMaskId = currentSelectedSlot?.maskShape || 'none';

  return (
    <div id="left-masks-drawer-panel" className="flex-1 flex flex-col h-full bg-[#f8f9fa] overflow-hidden select-none">
      {/* 顶部标题与说明 */}
      <div className="p-3 bg-white border-b border-[#e5e7eb] shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-neutral-800 tracking-tight">蒙版素材库</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#faf4f5] text-[#76383d] font-semibold border border-[#ebdbe0]">
              {MOMO_MASK_DEFINITIONS.length} 款精选
            </span>
          </div>
          {/* 网格列数切换 */}
          <div className="flex items-center space-x-0.5 bg-neutral-100 p-0.5 rounded-md border border-neutral-200">
            <button
              onClick={() => setGridCols(3)}
              className={`p-1 rounded cursor-pointer transition-colors ${
                gridCols === 3 ? 'bg-white shadow-2xs text-[#76383d]' : 'text-neutral-500 hover:text-neutral-800'
              }`}
              title="3列舒适视图"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setGridCols(4)}
              className={`p-1 rounded cursor-pointer transition-colors ${
                gridCols === 4 ? 'bg-white shadow-2xs text-[#76383d]' : 'text-neutral-500 hover:text-neutral-800'
              }`}
              title="4列紧凑视图"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索蒙版，如 拱门、猫、撕纸..."
            className="w-full pl-8 pr-6 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-hidden focus:border-[#76383d] focus:bg-white transition-all text-neutral-800 placeholder:text-neutral-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* 分类快捷标签栏 */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {MOMO_MASK_CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-all cursor-pointer shrink-0 font-medium ${
                  isSelected
                    ? 'bg-[#76383d] text-white shadow-2xs font-semibold'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                }`}
              >
                {cat.name}
                <span className={`ml-1 text-[9px] ${isSelected ? 'text-white/80' : 'text-neutral-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 选中状态提示条 */}
      <div className="px-3 py-1.5 bg-[#f5f5f7] border-b border-[#e9ebed] flex items-center justify-between text-[11px] shrink-0">
        {currentSelectedSlot ? (
          <div className="flex items-center space-x-1.5 text-neutral-700 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate">
              已选中画框，点击蒙版即刻赋予
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-1 text-neutral-500 truncate">
            <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="truncate">在画布选中照片后点击，或直接拖拽</span>
          </div>
        )}
      </div>

      {/* 蒙版图形网格列表 */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredMasks.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 space-y-2 text-neutral-400">
            <Layers className="w-8 h-8 stroke-[1.5]" />
            <p className="text-xs">未找到匹配的蒙版</p>
            <button
              onClick={() => {
                setActiveCategory('all');
                setSearchQuery('');
              }}
              className="text-xs text-[#76383d] hover:underline cursor-pointer"
            >
              查看全部蒙版
            </button>
          </div>
        ) : (
          <div
            className={`grid gap-2.5 ${
              gridCols === 3 ? 'grid-cols-3' : 'grid-cols-4'
            }`}
          >
            {filteredMasks.map((mask) => {
              const isApplied = currentSelectedSlot && currentMaskId === mask.id;
              return (
                <div
                  key={mask.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/momo-mask', mask.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => {
                    onApplyMask(mask.id);
                  }}
                  title={`${mask.name} (可点击应用或拖拽到画布)`}
                  className={`group relative flex flex-col items-center bg-white rounded-xl p-2 border transition-all cursor-pointer hover:shadow-md active:scale-95 ${
                    isApplied
                      ? 'border-[#76383d] ring-2 ring-[#76383d]/20 bg-[#faf4f5]/30'
                      : 'border-neutral-200 hover:border-[#76383d]/60 hover:bg-neutral-50/50'
                  }`}
                >
                  {/* 当前已应用角标 */}
                  {isApplied && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#76383d] text-white flex items-center justify-center shadow-xs z-10">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}

                  {/* 蒙版 SVG 渲染预览窗 */}
                  <div className="w-full aspect-square flex items-center justify-center p-1.5 rounded-lg bg-neutral-100/70 group-hover:bg-neutral-100 transition-colors">
                    {mask.isNone ? (
                      <div className="w-full h-full border border-dashed border-neutral-400 rounded-sm flex items-center justify-center bg-white text-[10px] text-neutral-500 font-medium">
                        矩形
                      </div>
                    ) : mask.pathD ? (
                      <svg
                        viewBox="0 0 100 100"
                        className="w-full h-full fill-neutral-800 drop-shadow-2xs group-hover:fill-[#76383d] transition-colors"
                      >
                        <path d={normalizePathBoundingBox(mask.pathD, 8, 92)} />
                      </svg>
                    ) : (
                      <div className="w-full h-full bg-neutral-800 rounded-sm" />
                    )}
                  </div>

                  {/* 蒙版名称 */}
                  <span
                    className={`mt-1.5 text-[11px] font-medium text-center truncate w-full leading-tight transition-colors ${
                      isApplied
                        ? 'text-[#76383d] font-bold'
                        : 'text-neutral-700 group-hover:text-[#76383d]'
                    }`}
                  >
                    {mask.name}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 底部功能栏 */}
      <div className="p-2.5 bg-white border-t border-[#e5e7eb] shrink-0 text-center">
        <p className="text-[10px] text-neutral-400">
          米莫印品矢量蒙版库 · 300 DPI 印刷级高精度切边
        </p>
      </div>
    </div>
  );
};
