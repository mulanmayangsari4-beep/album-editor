import React, { useState, useRef, useMemo } from 'react';
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

interface LocalSlotSnapshot {
  id: string;
  localCenterX: number; // 相对于初始包围盒几何中心的 X (百分比)
  localCenterY: number; // 相对于初始包围盒几何中心的 Y (百分比)
  width: number;
  height: number;
  rotation: number;
}

interface ResizeSnapshot {
  trueCenterX: number;
  trueCenterY: number;
  origLocalW: number;
  origLocalH: number;
  baseRotation: number;
  slots: LocalSlotSnapshot[];
}

interface LiveBoxState {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export const MultiSelectBoundingBox: React.FC<MultiSelectBoundingBoxProps> = ({
  pageId,
  selectedSlots,
  bookSpec,
  spacingConfig,
  onUpdateMultipleBounds,
  onCommitBounds,
  onStartMultiDrag,
}) => {
  const [activeHandle, setActiveHandle] = useState<ResizeHandleType | null>(null);
  const [liveBox, setLiveBox] = useState<LiveBoxState | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [rotateTooltipAngle, setRotateTooltipAngle] = useState<number | null>(null);
  const [liveRotation, setLiveRotation] = useState<number>(0);

  const boxRef = useRef<HTMLDivElement>(null);
  const rotateSnapshotRef = useRef<{
    centerPercentX: number;
    centerPercentY: number;
    localWidth: number;
    localHeight: number;
    baseRotation: number;
  } | null>(null);

  const resizeSnapshotRef = useRef<ResizeSnapshot | null>(null);

  if (!selectedSlots || selectedSlots.length < 2) return null;

  // 1. 获取组合旋转角度 baseRotation
  const firstRotation = selectedSlots[0].rotation || 0;
  const isUniformRotation = selectedSlots.every(
    (s) => Math.abs((((s.rotation || 0) - firstRotation + 540) % 360) - 180) < 0.1
  );
  const baseRotation = isUniformRotation ? firstRotation : 0;

  // 2. 精确计算 OBB 有向包围盒（彻底对齐几何中心）
  const obbGeometry = useMemo(() => {
    const parentElem = boxRef.current?.parentElement;
    const parentW = parentElem?.clientWidth || 500;
    const parentH = parentElem?.clientHeight || 500;

    const rad = (-baseRotation * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    // 计算各 slot 中心像素坐标
    const slotCentersPx = selectedSlots.map((s) => ({
      id: s.id,
      cx: ((s.x + s.width / 2) / 100) * parentW,
      cy: ((s.y + s.height / 2) / 100) * parentH,
      wPx: (s.width / 100) * parentW,
      hPx: (s.height / 100) * parentH,
      rotation: s.rotation || 0,
    }));

    const avgCenterPxX = slotCentersPx.reduce((sum, s) => sum + s.cx, 0) / selectedSlots.length;
    const avgCenterPxY = slotCentersPx.reduce((sum, s) => sum + s.cy, 0) / selectedSlots.length;

    let minLx = Infinity;
    let maxLx = -Infinity;
    let minLy = Infinity;
    let maxLy = -Infinity;

    // 旋转至局部正交系
    const rawLocalSlots = slotCentersPx.map((s) => {
      const dx = s.cx - avgCenterPxX;
      const dy = s.cy - avgCenterPxY;
      const lx = dx * cosR - dy * sinR;
      const ly = dx * sinR + dy * cosR;

      const halfW = s.wPx / 2;
      const halfH = s.hPx / 2;

      minLx = Math.min(minLx, lx - halfW);
      maxLx = Math.max(maxLx, lx + halfW);
      minLy = Math.min(minLy, ly - halfH);
      maxLy = Math.max(maxLy, ly + halfH);

      return {
        id: s.id,
        lx,
        ly,
        widthPercent: (s.wPx / parentW) * 100,
        heightPercent: (s.hPx / parentH) * 100,
        rotation: s.rotation,
      };
    });

    const localWidthPx = Math.max(10, maxLx - minLx);
    const localHeightPx = Math.max(10, maxLy - minLy);
    const localOffsetPxX = (minLx + maxLx) / 2;
    const localOffsetPxY = (minLy + maxLy) / 2;

    // 正向旋转回真实画布中心
    const radFwd = (baseRotation * Math.PI) / 180;
    const trueCenterPxX = avgCenterPxX + (localOffsetPxX * Math.cos(radFwd) - localOffsetPxY * Math.sin(radFwd));
    const trueCenterPxY = avgCenterPxY + (localOffsetPxX * Math.sin(radFwd) + localOffsetPxY * Math.cos(radFwd));

    // 各 slot 相对于真实包围盒几何中心的局部坐标（中心为 0, 0）
    const localSlotItems = rawLocalSlots.map((s) => ({
      id: s.id,
      localCenterX: ((s.lx - localOffsetPxX) / parentW) * 100,
      localCenterY: ((s.ly - localOffsetPxY) / parentH) * 100,
      width: s.widthPercent,
      height: s.heightPercent,
      rotation: s.rotation,
    }));

    return {
      trueCenterX: (trueCenterPxX / parentW) * 100,
      trueCenterY: (trueCenterPxY / parentH) * 100,
      localWidth: (localWidthPx / parentW) * 100,
      localHeight: (localHeightPx / parentH) * 100,
      localSlotItems,
    };
  }, [selectedSlots, baseRotation]);

  // 外框渲染尺寸与位置：在旋转或缩放过程中严格跟随 Live 状态，杜绝任何外部抖动
  const activeBoxWidth = isRotating && rotateSnapshotRef.current
    ? rotateSnapshotRef.current.localWidth
    : (liveBox ? liveBox.width : obbGeometry.localWidth);

  const activeBoxHeight = isRotating && rotateSnapshotRef.current
    ? rotateSnapshotRef.current.localHeight
    : (liveBox ? liveBox.height : obbGeometry.localHeight);

  const activeCenterX = isRotating && rotateSnapshotRef.current
    ? rotateSnapshotRef.current.centerPercentX
    : (liveBox ? liveBox.centerX : obbGeometry.trueCenterX);

  const activeCenterY = isRotating && rotateSnapshotRef.current
    ? rotateSnapshotRef.current.centerPercentY
    : (liveBox ? liveBox.centerY : obbGeometry.trueCenterY);

  const activeRotation = isRotating ? liveRotation : baseRotation;

  const boxLeft = activeCenterX - activeBoxWidth / 2;
  const boxTop = activeCenterY - activeBoxHeight / 2;

  // 3. 多选 OBB 自由旋转交互
  const handleStartRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const parentElem = boxRef.current?.parentElement;
    const parentRect = parentElem?.getBoundingClientRect() || { width: 500, height: 500, left: 0, top: 0 };

    const initialCenterPercentX = obbGeometry.trueCenterX;
    const initialCenterPercentY = obbGeometry.trueCenterY;
    const initialLocalWidth = obbGeometry.localWidth;
    const initialLocalHeight = obbGeometry.localHeight;
    const initialBaseRotation = baseRotation;

    rotateSnapshotRef.current = {
      centerPercentX: initialCenterPercentX,
      centerPercentY: initialCenterPercentY,
      localWidth: initialLocalWidth,
      localHeight: initialLocalHeight,
      baseRotation: initialBaseRotation,
    };

    const centerPixelX = parentRect.left + (initialCenterPercentX / 100) * parentRect.width;
    const centerPixelY = parentRect.top + (initialCenterPercentY / 100) * parentRect.height;
    const localCenterX = (initialCenterPercentX / 100) * parentRect.width;
    const localCenterY = (initialCenterPercentY / 100) * parentRect.height;

    const initialSlots = selectedSlots.map((s) => {
      const slotCenterX = ((s.x + s.width / 2) / 100) * parentRect.width;
      const slotCenterY = ((s.y + s.height / 2) / 100) * parentRect.height;
      return {
        id: s.id,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        rotation: s.rotation || 0,
        offsetX: slotCenterX - localCenterX,
        offsetY: slotCenterY - localCenterY,
      };
    });

    const startMouseAngle = Math.atan2(e.clientY - centerPixelY, e.clientX - centerPixelX) * (180 / Math.PI);
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    let hasMoved = false;

    setIsRotating(true);
    setLiveRotation(initialBaseRotation);
    setRotateTooltipAngle(Math.round(initialBaseRotation));

    const handleRotateMouseMove = (moveEvt: MouseEvent) => {
      const dist = Math.hypot(moveEvt.clientX - startClientX, moveEvt.clientY - startClientY);
      if (dist > 3) {
        hasMoved = true;
      }

      const currentMouseAngle =
        Math.atan2(moveEvt.clientY - centerPixelY, moveEvt.clientX - centerPixelX) * (180 / Math.PI);
      let rawDelta = currentMouseAngle - startMouseAngle;

      while (rawDelta > 180) rawDelta -= 360;
      while (rawDelta < -180) rawDelta += 360;

      let targetRot = (initialBaseRotation + rawDelta) % 360;
      if (targetRot > 180) targetRot -= 360;
      if (targetRot < -180) targetRot += 360;

      const snapAngles = [0, 90, 180, -90, -180, 45, -45, 135, -135];
      let snappedRot = targetRot;
      for (const snap of snapAngles) {
        if (Math.abs(targetRot - snap) < 2.5) {
          snappedRot = snap;
          break;
        }
      }

      setLiveRotation(snappedRot);
      setRotateTooltipAngle(Math.round(snappedRot));

      const angleDelta = snappedRot - initialBaseRotation;
      const radDelta = (angleDelta * Math.PI) / 180;
      const cosDelta = Math.cos(radDelta);
      const sinDelta = Math.sin(radDelta);

      const updates = initialSlots.map((s) => {
        const rotatedOffsetX = s.offsetX * cosDelta - s.offsetY * sinDelta;
        const rotatedOffsetY = s.offsetX * sinDelta + s.offsetY * cosDelta;

        const newCenterPxX = localCenterX + rotatedOffsetX;
        const newCenterPxY = localCenterY + rotatedOffsetY;

        const newCenterPercentX = (newCenterPxX / parentRect.width) * 100;
        const newCenterPercentY = (newCenterPxY / parentRect.height) * 100;

        let newSlotRotation = ((s.rotation || 0) + angleDelta) % 360;
        if (newSlotRotation > 180) newSlotRotation -= 360;
        if (newSlotRotation < -180) newSlotRotation += 360;

        return {
          slotId: s.id,
          bounds: {
            x: newCenterPercentX - s.width / 2,
            y: newCenterPercentY - s.height / 2,
            width: s.width,
            height: s.height,
            rotation: Math.round(newSlotRotation),
          },
        };
      });

      onUpdateMultipleBounds(pageId, updates);
    };

    const handleRotateMouseUp = () => {
      window.removeEventListener('mousemove', handleRotateMouseMove);
      window.removeEventListener('mouseup', handleRotateMouseUp);

      setIsRotating(false);
      setRotateTooltipAngle(null);
      rotateSnapshotRef.current = null;

      if (hasMoved) {
        onCommitBounds?.();
      }
    };

    window.addEventListener('mousemove', handleRotateMouseMove);
    window.addEventListener('mouseup', handleRotateMouseUp);
  };

  // 4. 多选 OBB 8 锚点缩放拉伸（100% 严丝合缝跟随照片，无漂移无脱节）
  const handleStartResize = (e: React.MouseEvent, handle: ResizeHandleType) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveHandle(handle);

    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const parentElem = boxRef.current?.parentElement;
    const parentRect = parentElem?.getBoundingClientRect() || { width: 500, height: 500 };

    // 锁定初始快照 Snapshot
    const snapshot: ResizeSnapshot = {
      trueCenterX: obbGeometry.trueCenterX,
      trueCenterY: obbGeometry.trueCenterY,
      origLocalW: obbGeometry.localWidth,
      origLocalH: obbGeometry.localHeight,
      baseRotation,
      slots: obbGeometry.localSlotItems.map((s) => ({
        id: s.id,
        localCenterX: s.localCenterX,
        localCenterY: s.localCenterY,
        width: s.width,
        height: s.height,
        rotation: s.rotation || 0,
      })),
    };

    resizeSnapshotRef.current = snapshot;

    const rad = (-baseRotation * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    const radFwd = (baseRotation * Math.PI) / 180;
    const cosFwd = Math.cos(radFwd);
    const sinFwd = Math.sin(radFwd);

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const snap = resizeSnapshotRef.current;
      if (!snap) return;

      const dxScreen = moveEvt.clientX - startClientX;
      const dyScreen = moveEvt.clientY - startClientY;

      // 投影到 OBB 局部正交坐标系
      const dxLocalPx = dxScreen * cosR - dyScreen * sinR;
      const dyLocalPx = dxScreen * sinR + dyScreen * cosR;

      const dxLocalPercent = (dxLocalPx / parentRect.width) * 100;
      const dyLocalPercent = (dyLocalPx / parentRect.height) * 100;

      const origW = snap.origLocalW;
      const origH = snap.origLocalH;

      let newW = origW;
      let newH = origH;
      let offsetShiftX = 0;
      let offsetShiftY = 0;

      if (['nw', 'ne', 'se', 'sw'].includes(handle)) {
        // 对角线等比缩放：基于对角线位移的平均比例进行对称约束
        let scale = 1;
        if (handle === 'se') {
          const sx = (origW + dxLocalPercent) / origW;
          const sy = (origH + dyLocalPercent) / origH;
          scale = Math.max(0.05, (sx + sy) / 2);
          newW = Math.max(2, origW * scale);
          newH = Math.max(2, origH * scale);
          offsetShiftX = (newW - origW) / 2;
          offsetShiftY = (newH - origH) / 2;
        } else if (handle === 'nw') {
          const sx = (origW - dxLocalPercent) / origW;
          const sy = (origH - dyLocalPercent) / origH;
          scale = Math.max(0.05, (sx + sy) / 2);
          newW = Math.max(2, origW * scale);
          newH = Math.max(2, origH * scale);
          offsetShiftX = -(newW - origW) / 2;
          offsetShiftY = -(newH - origH) / 2;
        } else if (handle === 'ne') {
          const sx = (origW + dxLocalPercent) / origW;
          const sy = (origH - dyLocalPercent) / origH;
          scale = Math.max(0.05, (sx + sy) / 2);
          newW = Math.max(2, origW * scale);
          newH = Math.max(2, origH * scale);
          offsetShiftX = (newW - origW) / 2;
          offsetShiftY = -(newH - origH) / 2;
        } else if (handle === 'sw') {
          const sx = (origW - dxLocalPercent) / origW;
          const sy = (origH + dyLocalPercent) / origH;
          scale = Math.max(0.05, (sx + sy) / 2);
          newW = Math.max(2, origW * scale);
          newH = Math.max(2, origH * scale);
          offsetShiftX = -(newW - origW) / 2;
          offsetShiftY = (newH - origH) / 2;
        }
      } else {
        // 单边方向拉伸 (如顶部 n 压低，底部 s 压高，左右 w/e)
        if (handle === 'e') {
          newW = Math.max(2, origW + dxLocalPercent);
          offsetShiftX = (newW - origW) / 2;
        } else if (handle === 'w') {
          newW = Math.max(2, origW - dxLocalPercent);
          offsetShiftX = -(newW - origW) / 2;
        } else if (handle === 's') {
          newH = Math.max(2, origH + dyLocalPercent);
          offsetShiftY = (newH - origH) / 2;
        } else if (handle === 'n') {
          newH = Math.max(2, origH - dyLocalPercent);
          offsetShiftY = -(newH - origH) / 2;
        }
      }

      // 计算外框世界几何中心 (旋转投影)
      const liveWorldCenterX = snap.trueCenterX + (offsetShiftX * cosFwd - offsetShiftY * sinFwd);
      const liveWorldCenterY = snap.trueCenterY + (offsetShiftX * sinFwd + offsetShiftY * cosFwd);

      setLiveBox({
        centerX: liveWorldCenterX,
        centerY: liveWorldCenterY,
        width: newW,
        height: newH,
      });

      // 缩放比例
      const scaleX = newW / origW;
      const scaleY = newH / origH;

      // 对所有内部 slot 执行严格与外框 1:1 同步的变换
      const updates = snap.slots.map((s) => {
        // 内部 slot 相对包围盒几何中心的位移进行等比缩放
        const newLocalCenterX = s.localCenterX * scaleX;
        const newLocalCenterY = s.localCenterY * scaleY;

        const newSlotW = Math.max(1, s.width * scaleX);
        const newSlotH = Math.max(1, s.height * scaleY);

        // 旋转投影回画布世界坐标 (加上外框中心位移)
        const worldCenterX = liveWorldCenterX + (newLocalCenterX * cosFwd - newLocalCenterY * sinFwd);
        const worldCenterY = liveWorldCenterY + (newLocalCenterX * sinFwd + newLocalCenterY * cosFwd);

        return {
          slotId: s.id,
          bounds: {
            x: worldCenterX - newSlotW / 2,
            y: worldCenterY - newSlotH / 2,
            width: newSlotW,
            height: newSlotH,
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
      setLiveBox(null);
      resizeSnapshotRef.current = null;
      onCommitBounds?.();

      const blockClick = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', blockClick, true);
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
        left: `${boxLeft}%`,
        top: `${boxTop}%`,
        width: `${activeBoxWidth}%`,
        height: `${activeBoxHeight}%`,
        transform: `rotate(${activeRotation}deg)`,
        transformOrigin: 'center center',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (selectedSlots.length > 0) {
          onStartMultiDrag(e, selectedSlots[0].id);
        }
      }}
      className="absolute pointer-events-none z-40 border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.22)] transition-none"
    >
      {/* 顶部中央圆形旋转把手 (OBB 有向随动旋转 + 实时角度气泡 + 磁吸对齐) */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-40">
        <button
          type="button"
          onMouseDown={handleStartRotate}
          className="w-5.5 h-5.5 rounded-full bg-white border border-neutral-200/90 shadow-[0_2px_5px_rgba(0,0,0,0.18)] flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 transition-transform text-neutral-500 hover:text-neutral-700"
          title="拖拽自由旋转所选照片组合 (靠近 0°/90°/180° 自动磁吸对齐)"
        >
          <RotateCw className="w-3 h-3 stroke-[2]" />
        </button>
        {/* 连接细线 */}
        <div className="w-[1px] h-1.5 bg-neutral-300 pointer-events-none" />
      </div>

      {/* 旋转实时角度气泡提示 (天蓝色徽章标签) */}
      {rotateTooltipAngle !== null && (
        <div className="absolute -top-7 left-[calc(50%+16px)] z-60 bg-[#3c78d8] text-white text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-[3px] shadow-md pointer-events-none whitespace-nowrap leading-none flex items-center select-none animate-fade-in tracking-tight">
          <span>{rotateTooltipAngle}°</span>
        </div>
      )}

      {/* 缩放调整中在左上方浮现天蓝色毫米标签 */}
      {activeHandle && (
        <div className="absolute -top-8 left-2 z-60 bg-[#3c78d8] text-white text-[9.5px] font-sans px-2 py-1 rounded-[4px] shadow-sm pointer-events-none whitespace-nowrap leading-[14px] flex flex-col items-start select-none animate-fade-in tracking-tight">
          <div className="flex items-center space-x-1">
            <span className="opacity-90">组合宽 :</span>
            <span className="font-medium">
              {((activeBoxWidth * (bookSpec?.widthMm || 200)) / 100).toFixed(1)}mm
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="opacity-90">组合高 :</span>
            <span className="font-medium">
              {((activeBoxHeight * (bookSpec?.heightMm || 200)) / 100).toFixed(1)}mm
            </span>
          </div>
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
