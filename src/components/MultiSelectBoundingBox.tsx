import React, { useState, useRef } from 'react';
import { FrameSlot, BookSpec, SpacingConfig } from '../types/editor';
import { RotateCw } from 'lucide-react';

interface MultiSelectBoundingBoxProps {
  pageId: string;
  selectedSlots: FrameSlot[];
  bookSpec: BookSpec;
  spacingConfig?: SpacingConfig;
  hairlineThickness?: number;
  onUpdateMultipleBounds: (
    pageId: string,
    updates: { slotId: string; bounds: { x: number; y: number; width: number; height: number; rotation?: number } }[]
  ) => void;
  onCommitBounds?: () => void;
  onDeleteMultiple?: (pageId: string, slotIds: string[]) => void;
  onStartMultiDrag: (e: React.MouseEvent, clickedSlotId: string) => void;
}

type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

/**
 * 辅助算法：计算固定间距保持 (Linked Spacing / Auto-Layout) 下的多图各子元素缩放与定位
 */
function computeClusterTransforms(
  items: { id: string; start: number; size: number }[],
  origBoxStart: number,
  origBoxSize: number,
  newBoxStart: number,
  newBoxSize: number,
  fixedGapPercent: number,
  isFixedGapEnabled: boolean
): Map<string, { start: number; size: number }> {
  const result = new Map<string, { start: number; size: number }>();
  if (items.length === 0) return result;

  if (!isFixedGapEnabled || fixedGapPercent <= 0) {
    // 自由移动/自由缩放：标准线性变换
    for (const item of items) {
      const relStart = (item.start - origBoxStart) / origBoxSize;
      const relSize = item.size / origBoxSize;
      result.set(item.id, {
        start: newBoxStart + relStart * newBoxSize,
        size: Math.max(1, relSize * newBoxSize),
      });
    }
    return result;
  }

  // 固定间隙模式：提取非重叠段 (Clusters)
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const clusters: { start: number; end: number }[] = [];

  for (const it of sorted) {
    const curStart = it.start;
    const curEnd = it.start + it.size;
    if (clusters.length === 0) {
      clusters.push({ start: curStart, end: curEnd });
    } else {
      const last = clusters[clusters.length - 1];
      // 如果和上一个区间有交集或紧贴，合并为一个 Cluster
      if (curStart <= last.end + 0.1) {
        last.end = Math.max(last.end, curEnd);
      } else {
        clusters.push({ start: curStart, end: curEnd });
      }
    }
  }

  const numGaps = clusters.length - 1;
  const totalFixedGaps = numGaps * fixedGapPercent;
  const origTotalClusterSizes = clusters.reduce((acc, c) => acc + (c.end - c.start), 0);
  const newAvailableClusterSizes = Math.max(1, newBoxSize - totalFixedGaps);
  const clusterScale = origTotalClusterSizes > 0 ? newAvailableClusterSizes / origTotalClusterSizes : 1;

  // 计算每个 cluster 的新起点和新尺寸
  const newClusters: { start: number; size: number }[] = [];
  let currentStart = newBoxStart;
  for (let i = 0; i < clusters.length; i++) {
    const origClusterSize = clusters[i].end - clusters[i].start;
    const newClusterSize = origClusterSize * clusterScale;
    newClusters.push({ start: currentStart, size: newClusterSize });
    currentStart += newClusterSize + fixedGapPercent;
  }

  // 映射回每个 item
  for (const it of items) {
    let cIdx = 0;
    for (let i = 0; i < clusters.length; i++) {
      if (it.start >= clusters[i].start - 0.2 && it.start + it.size <= clusters[i].end + 0.2) {
        cIdx = i;
        break;
      }
    }
    const origC = clusters[cIdx];
    const newC = newClusters[cIdx];
    const relOffsetInCluster = origC.end > origC.start ? (it.start - origC.start) / (origC.end - origC.start) : 0;
    const relSizeInCluster = origC.end > origC.start ? it.size / (origC.end - origC.start) : 1;

    result.set(it.id, {
      start: newC.start + relOffsetInCluster * newC.size,
      size: Math.max(1, relSizeInCluster * newC.size),
    });
  }

  return result;
}

export const MultiSelectBoundingBox: React.FC<MultiSelectBoundingBoxProps> = ({
  pageId,
  selectedSlots,
  bookSpec,
  spacingConfig,
  hairlineThickness = 1,
  onUpdateMultipleBounds,
  onCommitBounds,
  onDeleteMultiple,
  onStartMultiDrag,
}) => {
  const [activeHandle, setActiveHandle] = useState<ResizeHandleType | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  if (!selectedSlots || selectedSlots.length < 2) return null;

  const minX = Math.min(...selectedSlots.map((s) => s.x));
  const minY = Math.min(...selectedSlots.map((s) => s.y));
  const maxX = Math.max(...selectedSlots.map((s) => s.x + s.width));
  const maxY = Math.max(...selectedSlots.map((s) => s.y + s.height));

  const boxX = currentBox ? currentBox.x : minX;
  const boxY = currentBox ? currentBox.y : minY;
  const boxWidth = currentBox ? currentBox.width : maxX - minX;
  const boxHeight = currentBox ? currentBox.height : maxY - minY;

  // 1:1 还原米莫印品：拖动手柄进行多选整体缩放
  const handleStartResize = (e: React.MouseEvent, handle: ResizeHandleType) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveHandle(handle);

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const origBox = {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
    const origRight = origBox.x + origBox.width;
    const origBottom = origBox.y + origBox.height;

    const initialSlots = selectedSlots.map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      rotation: s.rotation,
    }));

    const parentElem = boxRef.current?.parentElement;
    const parentRect = parentElem?.getBoundingClientRect() || { width: 500, height: 500 };

    const isFixedSpacing = spacingConfig?.enabled ?? true;
    const gapPercentX = ((spacingConfig?.gapMm ?? 2) / (bookSpec?.widthMm || 200)) * 100;
    const gapPercentY = ((spacingConfig?.gapMm ?? 2) / (bookSpec?.heightMm || 200)) * 100;

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startClientX;
      const dy = moveEvt.clientY - startClientY;
      const dxPercent = (dx / parentRect.width) * 100;
      const dyPercent = (dy / parentRect.height) * 100;

      let newBoxX = origBox.x;
      let newBoxY = origBox.y;
      let newBoxW = origBox.width;
      let newBoxH = origBox.height;

      // 4 个角：严格以对角点为锚点的等比例缩放 (类似 Figma/Canva 标准模型)
      if (['nw', 'ne', 'se', 'sw'].includes(handle)) {
        let scale = 1;
        if (handle === 'se') {
          const scaleX = (origBox.width + dxPercent) / origBox.width;
          const scaleY = (origBox.height + dyPercent) / origBox.height;
          scale = Math.max(0.05, (scaleX + scaleY) / 2);
          newBoxW = Math.max(2, origBox.width * scale);
          newBoxH = (newBoxW / origBox.width) * origBox.height;
          newBoxX = origBox.x;
          newBoxY = origBox.y;
        } else if (handle === 'nw') {
          const scaleX = (origBox.width - dxPercent) / origBox.width;
          const scaleY = (origBox.height - dyPercent) / origBox.height;
          scale = Math.max(0.05, (scaleX + scaleY) / 2);
          newBoxW = Math.max(2, origBox.width * scale);
          newBoxH = (newBoxW / origBox.width) * origBox.height;
          newBoxX = origRight - newBoxW;
          newBoxY = origBottom - newBoxH;
        } else if (handle === 'ne') {
          const scaleX = (origBox.width + dxPercent) / origBox.width;
          const scaleY = (origBox.height - dyPercent) / origBox.height;
          scale = Math.max(0.05, (scaleX + scaleY) / 2);
          newBoxW = Math.max(2, origBox.width * scale);
          newBoxH = (newBoxW / origBox.width) * origBox.height;
          newBoxX = origBox.x;
          newBoxY = origBottom - newBoxH;
        } else if (handle === 'sw') {
          const scaleX = (origBox.width - dxPercent) / origBox.width;
          const scaleY = (origBox.height + dyPercent) / origBox.height;
          scale = Math.max(0.05, (scaleX + scaleY) / 2);
          newBoxW = Math.max(2, origBox.width * scale);
          newBoxH = (newBoxW / origBox.width) * origBox.height;
          newBoxX = origRight - newBoxW;
          newBoxY = origBox.y;
        }
      } else {
        // 4 条边：单向拉伸
        if (handle === 'e') {
          newBoxW = Math.max(2, origBox.width + dxPercent);
          newBoxH = origBox.height;
          newBoxX = origBox.x;
          newBoxY = origBox.y;
        } else if (handle === 'w') {
          newBoxW = Math.max(2, origBox.width - dxPercent);
          newBoxH = origBox.height;
          newBoxX = origRight - newBoxW;
          newBoxY = origBox.y;
        } else if (handle === 's') {
          newBoxW = origBox.width;
          newBoxH = Math.max(2, origBox.height + dyPercent);
          newBoxX = origBox.x;
          newBoxY = origBox.y;
        } else if (handle === 'n') {
          newBoxW = origBox.width;
          newBoxH = Math.max(2, origBox.height - dyPercent);
          newBoxX = origBox.x;
          newBoxY = origBottom - newBoxH;
        }
      }

      setCurrentBox({ x: newBoxX, y: newBoxY, width: newBoxW, height: newBoxH });

      // 计算并更新每个子画框的协同坐标和尺寸 (支持固定间隙联动保持)
      const xTransforms = computeClusterTransforms(
        initialSlots.map((s) => ({ id: s.id, start: s.x, size: s.width })),
        origBox.x,
        origBox.width,
        newBoxX,
        newBoxW,
        gapPercentX,
        isFixedSpacing
      );

      const yTransforms = computeClusterTransforms(
        initialSlots.map((s) => ({ id: s.id, start: s.y, size: s.height })),
        origBox.y,
        origBox.height,
        newBoxY,
        newBoxH,
        gapPercentY,
        isFixedSpacing
      );

      const updates = initialSlots.map((s) => {
        const transX = xTransforms.get(s.id) || { start: s.x, size: s.width };
        const transY = yTransforms.get(s.id) || { start: s.y, size: s.height };

        return {
          slotId: s.id,
          bounds: {
            x: transX.start,
            y: transY.start,
            width: transX.size,
            height: transY.size,
            rotation: s.rotation,
          },
        };
      });

      onUpdateMultipleBounds(pageId, updates);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setActiveHandle(null);
      setCurrentBox(null);
      onCommitBounds?.();

      // 在捕获阶段（Capture Phase）拦截并丢弃缩放结束后浏览器派发的原生点击事件，防止误触发底层画框的 onClick 单选切换
      const blockClick = (clickEvt: MouseEvent) => {
        clickEvt.stopPropagation();
        clickEvt.preventDefault();
        window.removeEventListener('click', blockClick, true);
      };
      window.addEventListener('click', blockClick, true);
      // 200ms 超时自动注销保护
      setTimeout(() => {
        window.removeEventListener('click', blockClick, true);
      }, 200);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={boxRef}
      style={{
        left: `${boxX}%`,
        top: `${boxY}%`,
        width: `${boxWidth}%`,
        height: `${boxHeight}%`,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (selectedSlots.length > 0) {
          onStartMultiDrag(e, selectedSlots[0].id);
        }
      }}
      className="absolute pointer-events-none z-40 border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.22)]"
    >
      {/* 底部圆形旋转把手 (带微小悬空与蓝色旋转弧线箭头) */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-40">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            // 多选旋转各画框
            const updates = selectedSlots.map((s) => ({
              slotId: s.id,
              bounds: {
                x: s.x,
                y: s.y,
                width: s.width,
                height: s.height,
                rotation: ((s.rotation || 0) + 90) % 360,
              },
            }));
            onUpdateMultipleBounds(pageId, updates);
            onCommitBounds?.();
          }}
          className="w-5 h-5 rounded-full bg-white border border-neutral-200/90 shadow-[0_2px_5px_rgba(0,0,0,0.18)] flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-transform text-[#3c78d8]"
          title="顺时针旋转所选照片"
        >
          <RotateCw className="w-2.5 h-2.5 stroke-[2.2]" />
        </button>
      </div>

      {/* 缩放调整中在左上方浮现天蓝色毫米标签 */}
      {activeHandle && (
        <div className="absolute -top-8 left-2 z-60 bg-[#3c78d8] text-white text-[9.5px] font-sans px-2 py-1 rounded-[4px] shadow-sm pointer-events-none whitespace-nowrap leading-[14px] flex flex-col items-start select-none animate-fade-in tracking-tight">
          <div className="flex items-center space-x-1">
            <span className="opacity-90">组合宽 :</span>
            <span className="font-medium">
              {((boxWidth * (bookSpec?.widthMm || 200)) / 100).toFixed(1)}mm
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="opacity-90">组合高 :</span>
            <span className="font-medium">
              {((boxHeight * (bookSpec?.heightMm || 200)) / 100).toFixed(1)}mm
            </span>
          </div>
          {spacingConfig?.enabled && (
            <div className="flex items-center space-x-1 text-white/95 border-t border-white/20 pt-0.5 mt-0.5">
              <span>固定间隙:</span>
              <span className="font-semibold">{spacingConfig.gapMm}mm</span>
            </div>
          )}
        </div>
      )}

      {/* 4 个角：柔和白色圆点 */}
      {(['nw', 'ne', 'se', 'sw'] as ResizeHandleType[]).map((handle) => {
        const handlePositions: Record<string, string> = {
          nw: '-top-1 -left-1 cursor-nwse-resize',
          ne: '-top-1 -right-1 cursor-nesw-resize',
          se: '-bottom-1 -right-1 cursor-nwse-resize',
          sw: '-bottom-1 -left-1 cursor-nesw-resize',
        };
        return (
          <div
            key={handle}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => handleStartResize(e, handle)}
            className={`absolute w-2.5 h-2.5 rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] pointer-events-auto z-40 select-none ${handlePositions[handle]}`}
            title="拖拽等比改变尺寸"
          />
        );
      })}

      {/* 4 条边中点：柔和圆角胶囊条 */}
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => handleStartResize(e, 'n')}
        className="absolute w-3.5 h-1.5 -top-[3px] left-1/2 -translate-x-1/2 rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ns-resize pointer-events-auto z-40 select-none"
        title="上下拉伸"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => handleStartResize(e, 's')}
        className="absolute w-3.5 h-1.5 -bottom-[3px] left-1/2 -translate-x-1/2 rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ns-resize pointer-events-auto z-40 select-none"
        title="上下拉伸"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => handleStartResize(e, 'w')}
        className="absolute w-1.5 h-3.5 top-1/2 -translate-y-1/2 -left-[3px] rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ew-resize pointer-events-auto z-40 select-none"
        title="左右拉伸"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => handleStartResize(e, 'e')}
        className="absolute w-1.5 h-3.5 top-1/2 -translate-y-1/2 -right-[3px] rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ew-resize pointer-events-auto z-40 select-none"
        title="左右拉伸"
      />
    </div>
  );
};

