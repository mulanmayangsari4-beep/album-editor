import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Check, Info } from 'lucide-react';
import {
  MIMO_STAMP_CATEGORIES,
  PRESET_STAMPS,
  PresetStamp,
  svgToDataUrl,
} from '../data/stamps';

interface StampsPanelProps {
  onAddStamp: (stamp: PresetStamp) => void;
  activeSide: 'left' | 'right' | null;
  onSelectSide: (side: 'left' | 'right') => void;
  currentPageNumber: { left: number; right: number };
}

export const StampsPanel: React.FC<StampsPanelProps> = ({
  onAddStamp,
}) => {
  // 默认展开第一个分类「宝宝」
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>('baby');
  // 当前选中的二级细分子分类
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>('baby_one_year');
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const toggleCategory = (catId: string) => {
    if (expandedCategoryId === catId) {
      setExpandedCategoryId(null);
    } else {
      setExpandedCategoryId(catId);
      const cat = MIMO_STAMP_CATEGORIES.find((c) => c.id === catId);
      if (cat && cat.subcategories.length > 0) {
        setSelectedSubcategoryId(cat.subcategories[0].id);
      } else {
        setSelectedSubcategoryId(null);
      }
    }
  };

  const handleSubcategorySelect = (catId: string, subId: string) => {
    setExpandedCategoryId(catId);
    setSelectedSubcategoryId(subId);
  };

  const handleStampClick = (stamp: PresetStamp) => {
    onAddStamp(stamp);
    setJustAddedId(stamp.id);
    setTimeout(() => setJustAddedId(null), 1000);
  };

  // 根据当前一级和二级选中过滤素材图章
  const filteredStamps = PRESET_STAMPS.filter((s) => {
    if (expandedCategoryId && s.category !== expandedCategoryId) {
      return false;
    }
    if (selectedSubcategoryId && s.subcategory && s.subcategory !== selectedSubcategoryId) {
      return false;
    }
    return true;
  });

  // 如果子分类无匹配素材，则退回显示该大类下的全部素材
  const displayStamps =
    filteredStamps.length > 0
      ? filteredStamps
      : PRESET_STAMPS.filter((s) => s.category === expandedCategoryId);

  return (
    <div className="flex flex-col h-full bg-[#f4f5f7] select-none">

      {/* 米莫风格：两级手风琴折叠菜单 */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-200/80 bg-white">
        {MIMO_STAMP_CATEGORIES.map((cat) => {
          const isExpanded = expandedCategoryId === cat.id;

          return (
            <div key={cat.id} className="bg-white">
              {/* 一级分类手风琴标题条 */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors cursor-pointer ${
                  isExpanded ? 'bg-neutral-50/80 text-neutral-900 font-semibold' : 'hover:bg-neutral-50 text-neutral-700 font-medium'
                }`}
              >
                <span className="text-xs tracking-wide">{cat.name}</span>
                <span className="text-neutral-400">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-neutral-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-neutral-400" />
                  )}
                </span>
              </button>

              {/* 二级主题细分列表与图章展示 */}
              {isExpanded && (
                <div className="bg-[#fafafa] border-t border-b border-neutral-100 px-3 py-3 space-y-3 animate-fade-in">
                  {/* 二级主题横向/纵向标签 */}
                  <div className="flex flex-wrap gap-1.5 pb-1 border-b border-neutral-200/60">
                    {cat.subcategories.map((sub) => {
                      const isSubSelected = selectedSubcategoryId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleSubcategorySelect(cat.id, sub.id)}
                          className={`px-2.5 py-1 text-[11px] rounded-md transition-all cursor-pointer ${
                            isSubSelected
                              ? 'bg-[#76383d] text-white font-medium shadow-2xs'
                              : 'bg-white text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 border border-neutral-200/70'
                          }`}
                        >
                          • {sub.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* 图章网格列表 */}
                  {displayStamps.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      {displayStamps.map((stamp) => {
                        const isJustAdded = justAddedId === stamp.id;
                        const dataUrl = svgToDataUrl(stamp.svgContent);

                        return (
                          <div
                            key={stamp.id}
                            draggable
                            onDragStart={(e) => {
                              // 米莫专用图章拖拽标识，绝不与照片 ID 混淆
                              e.dataTransfer.setData('text/momo-stamp-id', stamp.id);
                              e.dataTransfer.setData('text/plain', `stamp:${stamp.id}`);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onClick={() => handleStampClick(stamp)}
                            className={`group relative bg-white rounded-xl border p-2.5 flex flex-col items-center justify-between cursor-pointer transition-all duration-150 shadow-2xs ${
                              isJustAdded
                                ? 'border-[#76383d] ring-2 ring-[#76383d]/20 bg-[#faf5f6]'
                                : 'border-neutral-200/80 hover:border-[#76383d]/60 hover:shadow-md hover:-translate-y-0.5'
                            }`}
                            title="点击直接添加至当前页，或拖拽到画布任意位置"
                          >
                            {/* 预览图区域 */}
                            <div className="w-full aspect-square flex items-center justify-center p-2 rounded-lg bg-neutral-50/60 group-hover:bg-white transition-colors overflow-hidden">
                              <img
                                src={dataUrl}
                                alt={stamp.name}
                                className="max-w-full max-h-full object-contain filter drop-shadow-2xs select-none pointer-events-none group-hover:scale-105 transition-transform duration-200"
                              />
                            </div>

                            {/* 标题 */}
                            <div className="w-full mt-2 text-center">
                              <p className="text-[11px] font-medium text-neutral-700 truncate group-hover:text-[#76383d] transition-colors">
                                {stamp.name}
                              </p>
                            </div>

                            {/* 悬停快捷添加加号徽章 */}
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/90 shadow-xs border border-neutral-200 flex items-center justify-center text-neutral-500 group-hover:bg-[#76383d] group-hover:text-white group-hover:border-[#76383d] transition-colors">
                              {isJustAdded ? (
                                <Check className="w-3 h-3 stroke-[3]" />
                              ) : (
                                <Plus className="w-3 h-3 stroke-[2.5]" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-neutral-400 text-xs">
                      此主题暂无预设素材，可在模板后台自主录入上传
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部小贴士 */}
      <div className="p-3 bg-white border-t border-neutral-200 shrink-0">
        <div className="p-2 rounded-lg bg-amber-50/90 border border-amber-200/60 flex items-start space-x-2 text-[11px] text-amber-800 leading-relaxed">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            提示：图章不会占用照片托盘，可直接拖入画布任意位置或点击上版，支持 360° 旋转与 300 DPI 无损印刷导出。
          </span>
        </div>
      </div>
    </div>
  );
};
