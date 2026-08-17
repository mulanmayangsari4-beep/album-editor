import React, { useState } from 'react';
import { SpreadModel, UploadedPhoto, EditorViewConfig, PhotoCrop, BookSpec, SpacingConfig, FixedGapConfig } from '../types/editor';
import { PhotoFrame } from './PhotoFrame';
import { MultiSelectBoundingBox } from './MultiSelectBoundingBox';
import { calculateMoveSnap, GuideLine, SpacingGap } from '../utils/snapEngine';
import {
  Trash2,
  LayoutGrid,
  ArrowLeftRight,
  Layers,
  Copy,
} from 'lucide-react';

interface SpreadCanvasProps {
  spread: SpreadModel;
  bookSpec: BookSpec;
  viewConfig: EditorViewConfig;
  spacingConfig?: SpacingConfig;
  photos: UploadedPhoto[];
  selectedSlotId: string | null;
  selectedSlotIds?: string[];
  activeSide: 'left' | 'right' | null;
  onSelectSide: (side: 'left' | 'right' | null) => void;
  onSelectSlot: (slotId: string | null, isMultiToggle?: boolean) => void;
  onSelectMultipleSlots?: (slotIds: string[]) => void;
  onDropPhotoToSlot: (pageId: string, slotId: string, photoId: string) => void;
  onUpdateSlotCrop: (pageId: string, slotId: string, crop: PhotoCrop) => void;
  onClearSlotPhoto: (pageId: string, slotId: string) => void;
  onUpdateSlotText?: (pageId: string, slotId: string, text: string) => void;
  onUpdateSlotBounds?: (
    pageId: string,
    slotId: string,
    bounds: { x: number; y: number; width: number; height: number; rotation?: number }
  ) => void;
  onUpdateMultipleSlotsBounds?: (
    pageId: string,
    updates: { slotId: string; bounds: { x: number; y: number; width: number; height: number; rotation?: number } }[]
  ) => void;
  onCommitSlotBounds?: () => void;
  onDeleteSlot?: (pageId: string, slotId: string) => void;
  onDeleteMultipleSlots?: (pageId: string, slotIds: string[]) => void;
  onDuplicateSlot?: (pageId: string, slotId: string) => void;
  onSwapPhotos?: (slotIdA: string, slotIdB: string) => void;
  onSwapSpreadPagePhotos?: () => void;
  onOpenLayoutDrawer: (page: 'left' | 'right') => void;
  onClearPagePhotos: (page: 'left' | 'right') => void;
}

export const SpreadCanvas: React.FC<SpreadCanvasProps> = ({
  spread,
  bookSpec,
  viewConfig,
  spacingConfig,
  photos,
  selectedSlotId,
  selectedSlotIds = [],
  activeSide,
  onSelectSide,
  onSelectSlot,
  onSelectMultipleSlots,
  onDropPhotoToSlot,
  onUpdateSlotCrop,
  onClearSlotPhoto,
  onUpdateSlotText,
  onUpdateSlotBounds,
  onUpdateMultipleSlotsBounds,
  onCommitSlotBounds,
  onDeleteSlot,
  onDeleteMultipleSlots,
  onDuplicateSlot,
  onSwapPhotos,
  onSwapSpreadPagePhotos,
  onOpenLayoutDrawer,
  onClearPagePhotos,
}) => {
  const photoMap = new Map<string, UploadedPhoto>(photos.map((p) => [p.id, p]));
  // 缩放比例
  const zoomScale = (viewConfig.zoomPercent || 100) / 100;
  // 关键：发丝级极致 0.5px 细线补偿，彻底消除纯黑带来的膨胀感，全分辨率下呈现米莫级精细感
  const hairlineThickness = Math.max(0.5, 0.75 / zoomScale);

  const leftSelectedSlots = spread.leftPage.slots.filter((s) => selectedSlotIds.includes(s.id));
  const rightSelectedSlots = spread.rightPage.slots.filter((s) => selectedSlotIds.includes(s.id));

  // 智能对齐辅助线 (红线：边缘对齐；黄线：中轴对齐)
  const [leftGuides, setLeftGuides] = useState<GuideLine[]>([]);
  const [leftGaps, setLeftGaps] = useState<SpacingGap[]>([]);
  const [rightGuides, setRightGuides] = useState<GuideLine[]>([]);
  const [rightGaps, setRightGaps] = useState<SpacingGap[]>([]);

  // Adobe Illustrator 风格相交框选（Crossing/Intersect Marquee Selection）状态
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // 多选批量拖拽处理 (支持多选整体在单页内智能磁吸中轴线与吸附辅助线 - 方案 B)
  const handleStartMultiDrag = (
    e: React.MouseEvent,
    pageId: string,
    clickedSlotId: string,
    pageSlots: typeof spread.leftPage.slots
  ) => {
    e.stopPropagation();
    const effectiveSelectedIds = selectedSlotIds.length > 0 ? selectedSlotIds : [clickedSlotId];
    const initialSlots = pageSlots.filter((s) => effectiveSelectedIds.includes(s.id));
    if (initialSlots.length === 0) return;

    const unselectedSlots = pageSlots.filter((s) => !effectiveSelectedIds.includes(s.id));

    // 计算多选组合的初始外接包围盒
    const initialMinX = Math.min(...initialSlots.map((s) => s.x));
    const initialMinY = Math.min(...initialSlots.map((s) => s.y));
    const initialMaxX = Math.max(...initialSlots.map((s) => s.x + s.width));
    const initialMaxY = Math.max(...initialSlots.map((s) => s.y + s.height));
    const groupWidth = initialMaxX - initialMinX;
    const groupHeight = initialMaxY - initialMinY;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialPositions = new Map<string, { x: number; y: number }>(
      initialSlots.map((s) => [s.id, { x: s.x, y: s.y }])
    );

    const parentElem = (e.currentTarget as HTMLElement).closest('.relative');
    const parentRect = parentElem?.getBoundingClientRect() || { width: 500, height: 500 };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startClientX;
      const dy = moveEvt.clientY - startClientY;
      const dxPercent = (dx / parentRect.width) * 100;
      const dyPercent = (dy / parentRect.height) * 100;

      const rawGroupX = initialMinX + dxPercent;
      const rawGroupY = initialMinY + dyPercent;

      const fixedGapConfig: FixedGapConfig | undefined = spacingConfig ? {
        enabled: spacingConfig.enabled,
        gapMm: spacingConfig.gapMm,
        gapPercentX: ((spacingConfig.gapMm || 2) / (bookSpec?.widthMm || 200)) * 100,
        gapPercentY: ((spacingConfig.gapMm || 2) / (bookSpec?.heightMm || 200)) * 100,
      } : undefined;

      // 核心算法：以多选组合整体包围盒为计算实体，执行单页智能磁吸（50%水平/垂直中线与页面参考线）
      const snapRes = calculateMoveSnap(
        'multi-selection-group',
        rawGroupX,
        rawGroupY,
        groupWidth,
        groupHeight,
        unselectedSlots,
        parentRect.width,
        parentRect.height,
        fixedGapConfig
      );

      // 计算吸附后的整体平移增量
      const snappedDeltaX = snapRes.x - initialMinX;
      const snappedDeltaY = snapRes.y - initialMinY;

      // 将平移增量同步应用到组合内的每一个画框，严格维持各框之间的相对位置和间距
      const updates = initialSlots.map((s) => {
        const init = initialPositions.get(s.id) || { x: s.x, y: s.y };
        return {
          slotId: s.id,
          bounds: {
            x: Math.max(0, Math.min(100 - s.width, init.x + snappedDeltaX)),
            y: Math.max(0, Math.min(100 - s.height, init.y + snappedDeltaY)),
            width: s.width,
            height: s.height,
            rotation: s.rotation,
          },
        };
      });

      // 实时呈现单页磁吸辅助线（如单页50%中线高亮）
      if (pageId === spread.leftPage.id) {
        setLeftGuides(snapRes.guides);
        setLeftGaps(snapRes.spacingGaps || []);
      } else {
        setRightGuides(snapRes.guides);
        setRightGaps(snapRes.spacingGaps || []);
      }

      if (onUpdateMultipleSlotsBounds) {
        onUpdateMultipleSlotsBounds(pageId, updates);
      } else {
        updates.forEach((u) => onUpdateSlotBounds?.(pageId, u.slotId, u.bounds));
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      // 清空磁吸线
      if (pageId === spread.leftPage.id) {
        setLeftGuides([]);
        setLeftGaps([]);
      } else {
        setRightGuides([]);
        setRightGaps([]);
      }
      onCommitSlotBounds?.();

      // 在捕获阶段拦截并丢弃拖拽结束后的点击事件
      const blockClick = (clickEvt: MouseEvent) => {
        clickEvt.stopPropagation();
        clickEvt.preventDefault();
        window.removeEventListener('click', blockClick, true);
      };
      window.addEventListener('click', blockClick, true);
      setTimeout(() => {
        window.removeEventListener('click', blockClick, true);
      }, 200);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // --- Adobe Illustrator 风格相交框选 (碰触一点照片即可选中，自动过滤素材与文字) ---
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // 仅响应鼠标左键
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    // 如果点击在按钮、输入框、调整尺寸的手柄或画框本体上，不启动画布框选
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[title="拖拽改变尺寸"]') ||
      target.closest('[title="上下拉伸"]') ||
      target.closest('[title="左右拉伸"]') ||
      target.closest('[id^="slot-frame-"]')
    ) {
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;
    const isShiftOrCtrl = e.shiftKey || e.ctrlKey || e.metaKey;
    const initialSelectedIds = isShiftOrCtrl ? [...selectedSlotIds] : [];

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const currentX = moveEvt.clientX;
      const currentY = moveEvt.clientY;
      const dist = Math.hypot(currentX - startX, currentY - startY);

      if (!isDragging && dist > 3) {
        isDragging = true;
      }

      if (isDragging) {
        setMarqueeBox({
          startX,
          startY,
          currentX,
          currentY,
        });

        // 核心算法：AABB 矩形相交判定（Crossing Selection 触碰即选中）
        const boxLeft = Math.min(startX, currentX);
        const boxTop = Math.min(startY, currentY);
        const boxRight = Math.max(startX, currentX);
        const boxBottom = Math.max(startY, currentY);

        const newlyHitPhotoIds: string[] = [];
        const allSlots = [...spread.leftPage.slots, ...spread.rightPage.slots];

        allSlots.forEach((slot) => {
          // 严格类型过滤：只选照片！如果碰到素材、背景、文本框等，坚决不选中
          if (slot.type !== 'photo') return;

          const el = document.getElementById(`slot-frame-${slot.id}`);
          if (!el) return;
          const rect = el.getBoundingClientRect();

          // 只要框选框与照片框边界发生任意像素重叠/相交即判定命中
          const isIntersecting = !(
            boxRight < rect.left ||
            boxLeft > rect.right ||
            boxBottom < rect.top ||
            boxTop > rect.bottom
          );

          if (isIntersecting) {
            newlyHitPhotoIds.push(slot.id);
          }
        });

        const combined = Array.from(new Set([...initialSelectedIds, ...newlyHitPhotoIds]));
        if (onSelectMultipleSlots) {
          onSelectMultipleSlots(combined);
        } else {
          if (combined.length > 0) onSelectSlot(combined[0]);
        }
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setMarqueeBox(null);

      if (isDragging) {
        // 框选结束，在捕获阶段拦截后续原生合成的 click 事件，防止触发页面空白点击导致多选被清除
        const blockClick = (clickEvt: MouseEvent) => {
          clickEvt.stopPropagation();
          clickEvt.preventDefault();
          window.removeEventListener('click', blockClick, true);
        };
        window.addEventListener('click', blockClick, true);
        setTimeout(() => {
          window.removeEventListener('click', blockClick, true);
        }, 200);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <main
      id="main-spread-workarea"
      onMouseDown={handleCanvasMouseDown}
      onClick={(e) => {
        // 点击画板外部背景时取消单页/画框选中
        if (e.target === e.currentTarget) {
          onSelectSlot(null);
          onSelectSide(null);
        }
      }}
      className="flex-1 bg-[#ededf0] overflow-auto flex items-center justify-center p-4 md:p-8 select-none relative cursor-default"
      style={{
        backgroundImage: viewConfig.showGrid
          ? 'radial-gradient(#d3d5d9 1px, transparent 1px)'
          : undefined,
        backgroundSize: '20px 20px',
      }}
    >
      {/* 缩放画板包装层 */}
      <div
        id="spread-scale-container"
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease-out',
        }}
        className="flex items-center justify-center relative py-12"
      >
        {/* 双页展开书本体 */}
        <div
          id="double-page-spread-book"
          className="flex shadow-[0_4px_24px_rgba(0,0,0,0.08)] bg-white relative rounded-xs border border-[#dadce0]"
          style={{
            width: '920px',
            height: '460px',
          }}
        >
          {/* ========== 左页 ========== */}
          <div
            id={`page-left-${spread.leftPage.id}`}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) return;
              e.stopPropagation();
              onSelectSide('left');
              onSelectSlot(null); // 点击页面空白处激活整页
            }}
            style={{
              backgroundColor: spread.leftPage.backgroundColor || '#FFFFFF',
            }}
            className={`w-1/2 h-full relative flex flex-col justify-between cursor-default transition-all ${
              activeSide === 'left' ? 'z-10' : ''
            }`}
          >
            {/* 3mm 印刷裁切线 (1:1 辅线同款细密针脚发丝级虚线，内缩约 7px / 3mm) */}
            {viewConfig.showBleed && (
              <div className="absolute inset-[7px] pointer-events-none z-20 overflow-hidden">
                <svg className="w-full h-full" style={{ display: 'block' }}>
                  <rect
                    x="0.5"
                    y="0.5"
                    width="calc(100% - 1px)"
                    height="calc(100% - 1px)"
                    fill="none"
                    stroke="#e2827e"
                    strokeWidth={hairlineThickness}
                    strokeDasharray="2 2"
                    opacity="0.9"
                  />
                </svg>
              </div>
            )}

            {/* 安全裁切区虚线 */}
            {viewConfig.showSafeZone && (
              <div className="absolute inset-4 border border-dashed border-emerald-400/30 pointer-events-none z-20" />
            )}

            {/* 左页槽位列表 */}
            <div className="w-full h-full relative">
              {spread.leftPage.slots.map((slot, index) => (
                <PhotoFrame
                  key={slot.id}
                  slot={slot}
                  zIndex={index + 1}
                  hairlineThickness={hairlineThickness}
                  pageId={spread.leftPage.id}
                  photo={slot.photoId ? photoMap.get(slot.photoId) : undefined}
                  isSelected={selectedSlotId === slot.id}
                  isMultiSelected={selectedSlotIds.includes(slot.id)}
                  hasMultipleSelection={leftSelectedSlots.length > 1}
                  bookSpec={bookSpec}
                  otherSlots={spread.leftPage.slots}
                  spacingConfig={spacingConfig}
                  onSelect={(e) => {
                    onSelectSide('left');
                    const isCtrl = e ? e.ctrlKey || e.metaKey || e.shiftKey : false;
                    onSelectSlot(slot.id, isCtrl);
                  }}
                  onStartMultiDrag={(e, clickedId) =>
                    handleStartMultiDrag(e, spread.leftPage.id, clickedId, spread.leftPage.slots)
                  }
                  onDropPhoto={(photoId) =>
                    onDropPhotoToSlot(spread.leftPage.id, slot.id, photoId)
                  }
                  onUpdateCrop={(crop) =>
                    onUpdateSlotCrop(spread.leftPage.id, slot.id, crop)
                  }
                  onClearPhoto={() => onClearSlotPhoto(spread.leftPage.id, slot.id)}
                  onUpdateText={(text) =>
                    onUpdateSlotText?.(spread.leftPage.id, slot.id, text)
                  }
                  onUpdateBounds={(bounds) =>
                    onUpdateSlotBounds?.(spread.leftPage.id, slot.id, bounds)
                  }
                  onCommitBounds={onCommitSlotBounds}
                  onDeleteSlot={() => onDeleteSlot?.(spread.leftPage.id, slot.id)}
                  onDuplicateSlot={() => onDuplicateSlot?.(spread.leftPage.id, slot.id)}
                  onUpdateGuides={(guides, gaps) => {
                    setLeftGuides(guides);
                    setLeftGaps(gaps || []);
                  }}
                  onClearGuides={() => {
                    setLeftGuides([]);
                    setLeftGaps([]);
                  }}
                />
              ))}

              {/* 多选时的统一包围盒与协同缩放工具 */}
              {leftSelectedSlots.length > 1 && (
                <MultiSelectBoundingBox
                  pageId={spread.leftPage.id}
                  selectedSlots={leftSelectedSlots}
                  bookSpec={bookSpec}
                  spacingConfig={spacingConfig}
                  hairlineThickness={hairlineThickness}
                  onUpdateMultipleBounds={
                    onUpdateMultipleSlotsBounds ||
                    ((pid, updates) => updates.forEach((u) => onUpdateSlotBounds?.(pid, u.slotId, u.bounds)))
                  }
                  onCommitBounds={onCommitSlotBounds}
                  onDeleteMultiple={onDeleteMultipleSlots}
                  onStartMultiDrag={(e, clickedId) =>
                    handleStartMultiDrag(e, spread.leftPage.id, clickedId, spread.leftPage.slots)
                  }
                />
              )}
            </div>

            {/* ========== 1:1 还原米莫印品：选中左页时的优雅外框 (无旋转手柄、无8锚点，干净高级) ========== */}
            {activeSide === 'left' && !selectedSlotId && (
              <div className="absolute inset-0 pointer-events-none z-30 border-2 border-[#76383d]/50 shadow-[0_0_0_1px_rgba(118,56,61,0.2)]" />
            )}

            {/* 左页左下角「切换版式」按钮 */}
            <div className="absolute -bottom-8 left-0 z-30 pointer-events-auto">
              <button
                id="btn-switch-layout-left"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSide('left');
                  onSelectSlot(null);
                  onOpenLayoutDrawer('left');
                }}
                className={`px-2.5 py-1 text-[11px] rounded border shadow-2xs transition-all cursor-pointer flex items-center space-x-1 ${
                  activeSide === 'left' && !selectedSlotId
                    ? 'bg-[#76383d] text-white border-[#76383d] font-medium'
                    : 'bg-white hover:bg-neutral-50 text-neutral-700 border-[#dadce0]'
                }`}
              >
                <span>切换版式</span>
              </button>
            </div>
          </div>

          {/* 中央书脊中缝分界线 (纯净扁平无阴影) */}
          <div className="w-[1px] h-full bg-[#dadce0] relative z-20" />

          {/* ========== 右页 ========== */}
          <div
            id={`page-right-${spread.rightPage.id}`}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) return;
              e.stopPropagation();
              onSelectSide('right');
              onSelectSlot(null); // 点击页面空白处激活整页
            }}
            style={{
              backgroundColor: spread.rightPage.backgroundColor || '#FFFFFF',
            }}
            className={`w-1/2 h-full relative flex flex-col justify-between cursor-default transition-all ${
              activeSide === 'right' ? 'z-10' : ''
            }`}
          >
            {/* 3mm 印刷裁切线 (1:1 辅线同款细密针脚发丝级虚线，内缩约 7px / 3mm) */}
            {viewConfig.showBleed && (
              <div className="absolute inset-[7px] pointer-events-none z-20 overflow-hidden">
                <svg className="w-full h-full" style={{ display: 'block' }}>
                  <rect
                    x="0.5"
                    y="0.5"
                    width="calc(100% - 1px)"
                    height="calc(100% - 1px)"
                    fill="none"
                    stroke="#e2827e"
                    strokeWidth={hairlineThickness}
                    strokeDasharray="2 2"
                    opacity="0.9"
                  />
                </svg>
              </div>
            )}

            {/* 安全裁切区虚线 */}
            {viewConfig.showSafeZone && (
              <div className="absolute inset-4 border border-dashed border-emerald-400/30 pointer-events-none z-20" />
            )}

            {/* 右页槽位列表 */}
            <div className="w-full h-full relative">
              {spread.rightPage.slots.map((slot, index) => (
                <PhotoFrame
                  key={slot.id}
                  slot={slot}
                  zIndex={index + 1}
                  hairlineThickness={hairlineThickness}
                  pageId={spread.rightPage.id}
                  photo={slot.photoId ? photoMap.get(slot.photoId) : undefined}
                  isSelected={selectedSlotId === slot.id}
                  isMultiSelected={selectedSlotIds.includes(slot.id)}
                  hasMultipleSelection={rightSelectedSlots.length > 1}
                  bookSpec={bookSpec}
                  otherSlots={spread.rightPage.slots}
                  spacingConfig={spacingConfig}
                  onSelect={(e) => {
                    onSelectSide('right');
                    const isCtrl = e ? e.ctrlKey || e.metaKey || e.shiftKey : false;
                    onSelectSlot(slot.id, isCtrl);
                  }}
                  onStartMultiDrag={(e, clickedId) =>
                    handleStartMultiDrag(e, spread.rightPage.id, clickedId, spread.rightPage.slots)
                  }
                  onDropPhoto={(photoId) =>
                    onDropPhotoToSlot(spread.rightPage.id, slot.id, photoId)
                  }
                  onUpdateCrop={(crop) =>
                    onUpdateSlotCrop(spread.rightPage.id, slot.id, crop)
                  }
                  onClearPhoto={() => onClearSlotPhoto(spread.rightPage.id, slot.id)}
                  onUpdateText={(text) =>
                    onUpdateSlotText?.(spread.rightPage.id, slot.id, text)
                  }
                  onUpdateBounds={(bounds) =>
                    onUpdateSlotBounds?.(spread.rightPage.id, slot.id, bounds)
                  }
                  onCommitBounds={onCommitSlotBounds}
                  onDeleteSlot={() => onDeleteSlot?.(spread.rightPage.id, slot.id)}
                  onDuplicateSlot={() => onDuplicateSlot?.(spread.rightPage.id, slot.id)}
                  onUpdateGuides={(guides, gaps) => {
                    setRightGuides(guides);
                    setRightGaps(gaps || []);
                  }}
                  onClearGuides={() => {
                    setRightGuides([]);
                    setRightGaps([]);
                  }}
                />
              ))}

              {/* 多选时的统一包围盒与协同缩放工具 */}
              {rightSelectedSlots.length > 1 && (
                <MultiSelectBoundingBox
                  pageId={spread.rightPage.id}
                  selectedSlots={rightSelectedSlots}
                  bookSpec={bookSpec}
                  spacingConfig={spacingConfig}
                  hairlineThickness={hairlineThickness}
                  onUpdateMultipleBounds={
                    onUpdateMultipleSlotsBounds ||
                    ((pid, updates) => updates.forEach((u) => onUpdateSlotBounds?.(pid, u.slotId, u.bounds)))
                  }
                  onCommitBounds={onCommitSlotBounds}
                  onDeleteMultiple={onDeleteMultipleSlots}
                  onStartMultiDrag={(e, clickedId) =>
                    handleStartMultiDrag(e, spread.rightPage.id, clickedId, spread.rightPage.slots)
                  }
                />
              )}
            </div>

            {/* ========== 1:1 还原米莫印品：选中右页时的优雅外框 (无旋转手柄、无8锚点，干净高级) ========== */}
            {activeSide === 'right' && !selectedSlotId && (
              <div className="absolute inset-0 pointer-events-none z-30 border-2 border-[#76383d]/50 shadow-[0_0_0_1px_rgba(118,56,61,0.2)]" />
            )}

            {/* 右页右下角「切换版式」按钮 */}
            <div className="absolute -bottom-8 right-0 z-30 pointer-events-auto">
              <button
                id="btn-switch-layout-right"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectSide('right');
                  onSelectSlot(null);
                  onOpenLayoutDrawer('right');
                }}
                className={`px-2.5 py-1 text-[11px] rounded border shadow-2xs transition-all cursor-pointer flex items-center space-x-1 ${
                  activeSide === 'right' && !selectedSlotId
                    ? 'bg-[#76383d] text-white border-[#76383d] font-medium'
                    : 'bg-white hover:bg-neutral-50 text-neutral-700 border-[#dadce0]'
                }`}
              >
                <span>切换版式</span>
              </button>
            </div>
          </div>

          {/* ========== 全局跨页辅助线与间距高亮顶层图层 (z-60 pointer-events-none，绝不被中缝、单页、手柄遮挡) ========== */}
          <div className="absolute inset-0 pointer-events-none z-60 overflow-visible">
            {/* 左页对齐辅助线 */}
            {leftGuides.map((guide) => (
              <div
                key={`spread-guide-l-${guide.id}`}
                style={{
                  top: guide.orientation === 'horizontal' ? `${guide.position}%` : 0,
                  bottom: guide.orientation === 'horizontal' ? undefined : 0,
                  left: guide.orientation === 'vertical' ? `${guide.position * 0.5}%` : 0,
                  right: guide.orientation === 'vertical' ? undefined : '50%',
                  width: guide.orientation === 'vertical' ? `${hairlineThickness}px` : '50%',
                  height: guide.orientation === 'horizontal' ? `${hairlineThickness}px` : '100%',
                  opacity: 0.95,
                }}
                className="absolute pointer-events-none z-50"
              >
                {guide.orientation === 'horizontal' ? (
                  <svg className="w-full h-[1px] overflow-visible" style={{ height: `${hairlineThickness}px` }}>
                    <line
                      x1="0"
                      y1="0"
                      x2="100%"
                      y2="0"
                      stroke={guide.color === 'yellow' ? '#f59e0b' : '#e53935'}
                      strokeWidth={hairlineThickness}
                      strokeDasharray="2 2"
                    />
                  </svg>
                ) : (
                  <svg className="h-full w-[1px] overflow-visible" style={{ width: `${hairlineThickness}px` }}>
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="100%"
                      stroke={guide.color === 'yellow' ? '#f59e0b' : '#e53935'}
                      strokeWidth={hairlineThickness}
                      strokeDasharray="2 2"
                    />
                  </svg>
                )}
              </div>
            ))}

            {/* 右页对齐辅助线 */}
            {rightGuides.map((guide) => (
              <div
                key={`spread-guide-r-${guide.id}`}
                style={{
                  top: guide.orientation === 'horizontal' ? `${guide.position}%` : 0,
                  bottom: guide.orientation === 'horizontal' ? undefined : 0,
                  left: guide.orientation === 'vertical' ? `${50 + guide.position * 0.5}%` : '50%',
                  right: guide.orientation === 'vertical' ? undefined : 0,
                  width: guide.orientation === 'vertical' ? `${hairlineThickness}px` : '50%',
                  height: guide.orientation === 'horizontal' ? `${hairlineThickness}px` : '100%',
                  opacity: 0.95,
                }}
                className="absolute pointer-events-none z-50"
              >
                {guide.orientation === 'horizontal' ? (
                  <svg className="w-full h-[1px] overflow-visible" style={{ height: `${hairlineThickness}px` }}>
                    <line
                      x1="0"
                      y1="0"
                      x2="100%"
                      y2="0"
                      stroke={guide.color === 'yellow' ? '#f59e0b' : '#e53935'}
                      strokeWidth={hairlineThickness}
                      strokeDasharray="2 2"
                    />
                  </svg>
                ) : (
                  <svg className="h-full w-[1px] overflow-visible" style={{ width: `${hairlineThickness}px` }}>
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="100%"
                      stroke={guide.color === 'yellow' ? '#f59e0b' : '#e53935'}
                      strokeWidth={hairlineThickness}
                      strokeDasharray="2 2"
                    />
                  </svg>
                )}
              </div>
            ))}

            {/* 左页间隙高亮 */}
            {leftGaps.map((gap) => (
              <div
                key={`spread-gap-l-${gap.id}`}
                style={{
                  left: `${gap.x * 0.5}%`,
                  top: `${gap.y}%`,
                  width: `${gap.width * 0.5}%`,
                  height: `${gap.height}%`,
                  borderLeftWidth: `${hairlineThickness}px`,
                  borderRightWidth: `${hairlineThickness}px`,
                  borderTopWidth: `${hairlineThickness}px`,
                  borderBottomWidth: `${hairlineThickness}px`,
                }}
                className="absolute pointer-events-none z-55 bg-[#76383d]/12 border-[#76383d]/30 animate-fade-in flex items-center justify-center overflow-visible"
              >
                {gap.label && (
                  <span className="text-[10px] font-sans font-medium px-2 py-0.5 bg-[#76383d] text-white rounded-full whitespace-nowrap shadow-[0_2px_6px_rgba(0,0,0,0.35)] select-none pointer-events-none z-60 transform scale-95 transition-transform">
                    {gap.label}
                  </span>
                )}
              </div>
            ))}

            {/* 右页间隙高亮 */}
            {rightGaps.map((gap) => (
              <div
                key={`spread-gap-r-${gap.id}`}
                style={{
                  left: `${50 + gap.x * 0.5}%`,
                  top: `${gap.y}%`,
                  width: `${gap.width * 0.5}%`,
                  height: `${gap.height}%`,
                  borderLeftWidth: `${hairlineThickness}px`,
                  borderRightWidth: `${hairlineThickness}px`,
                  borderTopWidth: `${hairlineThickness}px`,
                  borderBottomWidth: `${hairlineThickness}px`,
                }}
                className="absolute pointer-events-none z-55 bg-[#76383d]/12 border-[#76383d]/30 animate-fade-in flex items-center justify-center overflow-visible"
              >
                {gap.label && (
                  <span className="text-[10px] font-sans font-medium px-2 py-0.5 bg-[#76383d] text-white rounded-full whitespace-nowrap shadow-[0_2px_6px_rgba(0,0,0,0.35)] select-none pointer-events-none z-60 transform scale-95 transition-transform">
                    {gap.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ========== 选中单页时下方出现的快捷工具悬浮小条 (仅在选整页时出现) ========== */}
        {activeSide && !selectedSlotId && selectedSlotIds.length === 0 && (
          <div
            id="page-quick-floating-toolbar"
            className="absolute -bottom-2 bg-white border border-[#dadce0] rounded-xs shadow-md px-2 py-1 flex items-center space-x-2 text-neutral-600 text-xs z-40 animate-fade-in"
            style={{
              left: activeSide === 'left' ? '25%' : '75%',
              transform: 'translateX(-50%)',
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenLayoutDrawer(activeSide);
              }}
              className="p-1 hover:bg-neutral-100 hover:text-[#76383d] rounded cursor-pointer transition-colors"
              title="切换当前页版式"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <div className="w-[1px] h-3.5 bg-neutral-200" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearPagePhotos(activeSide);
              }}
              className="p-1 hover:bg-[#faf4f5] hover:text-[#76383d] rounded cursor-pointer transition-colors"
              title="清空当前单页照片"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========== 方案1：多选时出现在下方的精简浮动操作工具栏 (重点：选 2 个画框时专属呈现 ⇄ 互换照片 按钮) ========== */}
        {selectedSlotIds.length >= 2 && (
          <div
            id="multi-selection-floating-toolbar"
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white border border-[#dadce0] rounded-md shadow-lg px-2.5 py-1.5 flex items-center space-x-2.5 text-neutral-700 text-xs z-50 animate-fade-in select-none"
          >
            <span className="text-[11px] font-medium text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
              已选中 {selectedSlotIds.length} 个画框
            </span>

            {/* 核心功能：当恰好选中 2 个画框时，显示醒目的 ⇄ 互换照片 按钮 */}
            {selectedSlotIds.length === 2 && onSwapPhotos && (
              <>
                <div className="w-[1px] h-4 bg-neutral-200" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwapPhotos(selectedSlotIds[0], selectedSlotIds[1]);
                  }}
                  className="px-2.5 py-1 bg-[#76383d] hover:bg-[#5f2c30] active:scale-95 text-white rounded font-medium cursor-pointer transition-all flex items-center space-x-1.5 shadow-xs"
                  title="互换两张照片的位置 (快捷键: X)"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>互换照片</span>
                  <span className="text-[10px] opacity-75 ml-0.5 font-mono">(X)</span>
                </button>
              </>
            )}

            <div className="w-[1px] h-4 bg-neutral-200" />

            {/* 批量删除按钮 */}
            {onDeleteMultipleSlots && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteMultipleSlots(
                    leftSelectedSlots.length > 0 ? spread.leftPage.id : spread.rightPage.id,
                    selectedSlotIds
                  );
                }}
                className="p-1 hover:bg-rose-50 text-neutral-600 hover:text-rose-600 rounded cursor-pointer transition-colors flex items-center space-x-1"
                title="删除选中的画框 (Delete / Backspace)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="text-[11px]">删除</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========== Adobe Illustrator 风格半透明框选矩形 (纯净矢量蓝 + 极细轮廓) ========== */}
      {marqueeBox && (
        <div
          id="marquee-selection-box"
          className="fixed pointer-events-none z-100 border border-[#2563eb] bg-[#3b82f6]/15 shadow-[0_0_0_1px_rgba(37,99,235,0.25)] rounded-[1px]"
          style={{
            left: `${Math.min(marqueeBox.startX, marqueeBox.currentX)}px`,
            top: `${Math.min(marqueeBox.startY, marqueeBox.currentY)}px`,
            width: `${Math.abs(marqueeBox.currentX - marqueeBox.startX)}px`,
            height: `${Math.abs(marqueeBox.currentY - marqueeBox.startY)}px`,
          }}
        />
      )}
    </main>
  );
};
