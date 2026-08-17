import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Camera,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Trash2,
  Move,
  Copy,
  AlertTriangle,
} from 'lucide-react';
import { FrameSlot, UploadedPhoto, PhotoCrop, BookSpec, SpacingConfig, FixedGapConfig } from '../types/editor';
import { calculateMoveSnap, calculateResizeSnap, GuideLine, SpacingGap } from '../utils/snapEngine';

// 1:1 米莫印品 小手平移图标 (细线矢量轮廓)
const IconMemoHand: React.FC<{ isGrabbing?: boolean }> = ({ isGrabbing }) => (
  <svg
    className="w-4 h-4 text-[#333333] select-none pointer-events-none"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {isGrabbing ? (
      /* 握拳抓取状态 */
      <path d="M18 11V8a2 2 0 0 0-2-2 2 2 0 0 0-2 2v3M14 10V8a2 2 0 0 0-2-2 2 2 0 0 0-2 2v3M10 11V9a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-3a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
    ) : (
      /* 米莫同款 张开手掌线框 */
      <>
        <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5" />
        <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6" />
        <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
      </>
    )}
  </svg>
);

// 方案 1：专业印刷级圆角黄色警示三角牌 + 居中黑色感叹号
const IconWarningTriangle: React.FC<{ isSevere?: boolean }> = ({ isSevere }) => (
  <svg
    viewBox="0 0 24 24"
    className={`w-4.5 h-4.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)] select-none pointer-events-none ${
      isSevere ? 'text-[#e53935] animate-pulse' : 'text-[#f59e0b]'
    }`}
  >
    {/* 圆角警示三角牌明黄色底 */}
    <path
      d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
      fill="currentColor"
    />
    {/* 居中清晰黑色感叹号：上圆角粗直条 + 下黑点 */}
    <line
      x1="12"
      y1="8.5"
      x2="12"
      y2="13.2"
      stroke="#111827"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <circle
      cx="12"
      cy="16.8"
      r="1.25"
      fill="#111827"
    />
  </svg>
);

interface PhotoFrameProps {
  slot: FrameSlot;
  photo?: UploadedPhoto;
  pageId: string;
  isSelected: boolean;
  isMultiSelected?: boolean;
  bookSpec?: BookSpec;
  otherSlots?: FrameSlot[];
  onSelect: (e?: React.MouseEvent) => void;
  onDropPhoto: (photoId: string) => void;
  onUpdateCrop: (crop: PhotoCrop) => void;
  onClearPhoto: () => void;
  onUpdateText?: (text: string) => void;
  onUpdateBounds?: (bounds: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onCommitBounds?: () => void;
  onDeleteSlot?: () => void;
  onDuplicateSlot?: () => void;
  onUpdateGuides?: (guides: GuideLine[], spacingGaps?: SpacingGap[]) => void;
  onClearGuides?: () => void;
  onStartMultiDrag?: (e: React.MouseEvent, clickedSlotId: string) => void;
  hasMultipleSelection?: boolean;
  spacingConfig?: SpacingConfig;
  zIndex?: number;
  hairlineThickness?: number;
}

type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const PhotoFrame: React.FC<PhotoFrameProps> = ({
  slot,
  photo,
  isSelected,
  isMultiSelected = false,
  hasMultipleSelection = false,
  bookSpec,
  otherSlots,
  spacingConfig,
  onSelect,
  onDropPhoto,
  onUpdateCrop,
  onClearPhoto,
  onUpdateText,
  onUpdateBounds,
  onCommitBounds,
  onDeleteSlot,
  onDuplicateSlot,
  onUpdateGuides,
  onClearGuides,
  onStartMultiDrag,
  zIndex,
  hairlineThickness = 1,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingCrop, setIsEditingCrop] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [textVal, setTextVal] = useState(slot.text || '');

  // 1. 照片内部裁剪/平移状态
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; cropX: number; cropY: number }>({
    x: 0,
    y: 0,
    cropX: 50,
    cropY: 50,
  });

  // 2. 画框整体拖拽移动状态 (Drag-to-move DIY)
  const [isMovingFrame, setIsMovingFrame] = useState(false);
  const moveStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialX: number;
    initialY: number;
    parentWidth: number;
    parentHeight: number;
  }>({
    clientX: 0,
    clientY: 0,
    initialX: slot.x,
    initialY: slot.y,
    parentWidth: 1,
    parentHeight: 1,
  });

  // 使用 Ref 实时同步 slot 和 otherSlots，防止在拖拽事件监听闭包中读取到过时陈旧的数据
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const otherSlotsRef = useRef(otherSlots || []);
  otherSlotsRef.current = otherSlots || [];

  // 3. 画框 8 锚点缩放调整状态 (Resize handles DIY)
  const [activeResizeHandle, setActiveResizeHandle] = useState<ResizeHandleType | null>(null);
  const resizeStartRef = useRef<{
    clientX: number;
    clientY: number;
    initialX: number;
    initialY: number;
    initialWidth: number;
    initialHeight: number;
    parentWidth: number;
    parentHeight: number;
  }>({
    clientX: 0,
    clientY: 0,
    initialX: slot.x,
    initialY: slot.y,
    initialWidth: slot.width,
    initialHeight: slot.height,
    parentWidth: 1,
    parentHeight: 1,
  });

  const frameRef = useRef<HTMLDivElement>(null);
  const crop = slot.crop || { x: 50, y: 50, scale: 1.0, rotation: 0 };

  // 计算照片是否大于画框（存在裁剪溢出或放大状态，此时显示米莫小手平移按钮）
  const isPhotoOverflowing = useMemo(() => {
    if (!photo) return false;
    if ((crop.scale || 1) > 1.02) return true;
    const frameW = slot.width * (bookSpec?.widthMm || 200);
    const frameH = slot.height * (bookSpec?.heightMm || 200);
    if (frameW <= 0 || frameH <= 0) return false;
    const frameRatio = frameW / frameH;
    const isRotated = (crop.rotation || 0) % 180 !== 0;
    const pW = isRotated ? photo.naturalHeight : photo.naturalWidth;
    const pH = isRotated ? photo.naturalWidth : photo.naturalHeight;
    if (!pW || !pH) return true;
    const photoRatio = pW / pH;
    return Math.abs(frameRatio - photoRatio) > 0.015;
  }, [photo, slot.width, slot.height, bookSpec, crop.scale, crop.rotation]);

  useEffect(() => {
    setTextVal(slot.text || '');
  }, [slot.text]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const photoId = e.dataTransfer.getData('text/plain');
    if (photoId) {
      onDropPhoto(photoId);
    }
  };

  // --- 照片裁剪平移 (米莫小手抓取平移) ---
  const handleStartPan = (e: React.MouseEvent) => {
    if (!photo) return;
    e.stopPropagation();
    e.preventDefault();
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cropX: crop.x,
      cropY: crop.y,
    };
  };

  useEffect(() => {
    const handleCropMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;

      const rect = frameRef.current?.getBoundingClientRect();
      const frameW = rect?.width || 200;
      const frameH = rect?.height || 200;

      // 物理级 1:1 敏捷跟随：
      // 在放大模式下，只要照片被放大或有裁剪溢出，直接允许 0-100% 自由全向调节
      const scale = Math.max(1.0, crop.scale || 1.0);
      const sensitivityX = (100 / Math.max(frameW, 50)) * scale;
      const sensitivityY = (100 / Math.max(frameH, 50)) * scale;

      const newX = Math.max(0, Math.min(100, panStartRef.current.cropX - dx * sensitivityX));
      const newY = Math.max(0, Math.min(100, panStartRef.current.cropY - dy * sensitivityY));

      onUpdateCrop({
        ...crop,
        x: Math.round(newX * 10) / 10,
        y: Math.round(newY * 10) / 10,
      });
    };

    const handleCropMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
        onCommitBounds?.();
      }
    };

    if (isPanning) {
      window.addEventListener('mousemove', handleCropMouseMove);
      window.addEventListener('mouseup', handleCropMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleCropMouseMove);
      window.removeEventListener('mouseup', handleCropMouseUp);
    };
  }, [isPanning, crop, onUpdateCrop, onCommitBounds]);

  // 本地实时拖拽/缩放临时坐标（在鼠标移动过程中直接更新局部状态，实现零延迟丝滑吸附）
  const [localBounds, setLocalBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // --- 画框整体在页面内的拖拽移动 (Move + 智能磁吸对齐，且支持多选整体拖拽) ---
  const handleStartMoveFrame = (e: React.MouseEvent) => {
    if (isEditingCrop || isEditingText) return;
    e.stopPropagation();

    // 如果按下 Ctrl / Cmd / Shift，进行多选增量切换
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onSelect(e);
      return;
    }

    // 只有在真正存在多个画框被联合选中（2个及以上，hasMultipleSelection=true）且当前画框属于其中时，才转交多选成组拖拽
    if (hasMultipleSelection && isMultiSelected) {
      if (onStartMultiDrag) {
        onStartMultiDrag(e, slot.id);
      }
      return;
    }

    // 普通单选
    onSelect(e);

    const parentElem = frameRef.current?.parentElement;
    if (!parentElem) return;
    const parentRect = parentElem.getBoundingClientRect();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialX = slot.x ?? slotRef.current.x;
    const initialY = slot.y ?? slotRef.current.y;
    const initialW = slot.width ?? slotRef.current.width;
    const initialH = slot.height ?? slotRef.current.height;
    const parentW = parentRect && parentRect.width > 10 ? parentRect.width : 500;
    const parentH = parentRect && parentRect.height > 10 ? parentRect.height : 500;

    // 快照当前所有其他兄弟画框的位置（优先直接读取最新 Props，消除 Mount 微任务时序差）
    const rawOthers = (otherSlots && otherSlots.length > 0) ? otherSlots : (otherSlotsRef.current || []);
    const otherSlotsSnapshot = rawOthers.filter((s) => s.id !== slot.id);

    let currentSnappedX = initialX;
    let currentSnappedY = initialY;

    setIsMovingFrame(true);

    const handleFrameMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startClientX;
      const dy = moveEvt.clientY - startClientY;

      const dxPercent = (dx / parentW) * 100;
      const dyPercent = (dy / parentH) * 100;

      const rawX = initialX + dxPercent;
      const rawY = initialY + dyPercent;

      const fixedGapConfig: FixedGapConfig | undefined = spacingConfig ? {
        enabled: spacingConfig.enabled,
        gapMm: spacingConfig.gapMm,
        gapPercentX: ((spacingConfig.gapMm || 2) / (bookSpec?.widthMm || 200)) * 100,
        gapPercentY: ((spacingConfig.gapMm || 2) / (bookSpec?.heightMm || 200)) * 100,
      } : undefined;

      // 实时智能磁吸对齐算法（使用快照、精准几何参数与物理像素尺寸，支持固定间隙自动吸附）
      const snapRes = calculateMoveSnap(
        slot.id,
        rawX,
        rawY,
        initialW,
        initialH,
        otherSlotsSnapshot,
        parentW,
        parentH,
        fixedGapConfig
      );

      currentSnappedX = snapRes.x;
      currentSnappedY = snapRes.y;

      // 1. 即时更新本地坐标与视觉位置
      setLocalBounds({
        x: snapRes.x,
        y: snapRes.y,
        width: initialW,
        height: initialH,
      });

      // 2. 实时更新吸附辅助线
      onUpdateGuides?.(snapRes.guides, snapRes.spacingGaps);

      // 3. 同步给父级
      onUpdateBounds?.({
        x: snapRes.x,
        y: snapRes.y,
        width: initialW,
        height: initialH,
      });
    };

    const handleFrameMouseUp = () => {
      window.removeEventListener('mousemove', handleFrameMouseMove);
      window.removeEventListener('mouseup', handleFrameMouseUp);

      setIsMovingFrame(false);
      setLocalBounds(null);
      onClearGuides?.();

      onUpdateBounds?.({
        x: currentSnappedX,
        y: currentSnappedY,
        width: initialW,
        height: initialH,
      });
      onCommitBounds?.();
    };

    window.addEventListener('mousemove', handleFrameMouseMove);
    window.addEventListener('mouseup', handleFrameMouseUp);
  };

  // --- 画框 8 锚点拖拽缩放 (Resize + 边缘智能吸附) ---
  const handleStartResize = (e: React.MouseEvent, handle: ResizeHandleType) => {
    e.stopPropagation();
    onSelect();

    const parentElem = frameRef.current?.parentElement;
    if (!parentElem) return;
    const parentRect = parentElem.getBoundingClientRect();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialX = slot.x ?? slotRef.current.x;
    const initialY = slot.y ?? slotRef.current.y;
    const initialW = slot.width ?? slotRef.current.width;
    const initialH = slot.height ?? slotRef.current.height;
    const parentW = parentRect && parentRect.width > 10 ? parentRect.width : 500;
    const parentH = parentRect && parentRect.height > 10 ? parentRect.height : 500;

    const rawOthers = (otherSlots && otherSlots.length > 0) ? otherSlots : (otherSlotsRef.current || []);
    const otherSlotsSnapshot = rawOthers.filter((s) => s.id !== slot.id);

    const fixedGapConfig: FixedGapConfig | undefined = spacingConfig ? {
      enabled: spacingConfig.enabled,
      gapMm: spacingConfig.gapMm,
      gapPercentX: ((spacingConfig.gapMm || 2) / (bookSpec?.widthMm || 200)) * 100,
      gapPercentY: ((spacingConfig.gapMm || 2) / (bookSpec?.heightMm || 200)) * 100,
    } : undefined;

    let currentSnappedX = initialX;
    let currentSnappedY = initialY;
    let currentSnappedW = initialW;
    let currentSnappedH = initialH;

    setActiveResizeHandle(handle);

    const handleResizeMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startClientX;
      const dy = moveEvt.clientY - startClientY;

      const dxPercent = (dx / parentW) * 100;
      const dyPercent = (dy / parentH) * 100;

      let newX = initialX;
      let newY = initialY;
      let newWidth = initialW;
      let newHeight = initialH;

      const minSize = 8; // 最小尺寸百分比

      // 根据拖动的锚点方向计算候选坐标与宽高
      if (handle.includes('e')) {
        newWidth = Math.max(minSize, Math.min(100 - newX, initialW + dxPercent));
      }
      if (handle.includes('s')) {
        newHeight = Math.max(minSize, Math.min(100 - newY, initialH + dyPercent));
      }
      if (handle.includes('w')) {
        const potentialWidth = initialW - dxPercent;
        if (potentialWidth >= minSize) {
          newX = Math.max(0, initialX + dxPercent);
          newWidth = potentialWidth;
        }
      }
      if (handle.includes('n')) {
        const potentialHeight = initialH - dyPercent;
        if (potentialHeight >= minSize) {
          newY = Math.max(0, initialY + dyPercent);
          newHeight = potentialHeight;
        }
      }

      // 计算拉伸过程中的边缘吸附（基于屏幕物理像素，支持固定间隙保持）
      const snapRes = calculateResizeSnap(
        slot.id,
        newX,
        newY,
        newWidth,
        newHeight,
        handle,
        otherSlotsSnapshot,
        parentW,
        parentH,
        fixedGapConfig
      );

      currentSnappedX = snapRes.x;
      currentSnappedY = snapRes.y;
      currentSnappedW = snapRes.width;
      currentSnappedH = snapRes.height;

      setLocalBounds({
        x: snapRes.x,
        y: snapRes.y,
        width: snapRes.width,
        height: snapRes.height,
      });

      onUpdateGuides?.(snapRes.guides, snapRes.spacingGaps);

      onUpdateBounds?.({
        x: snapRes.x,
        y: snapRes.y,
        width: snapRes.width,
        height: snapRes.height,
      });
    };

    const handleResizeMouseUp = () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);

      setActiveResizeHandle(null);
      setLocalBounds(null);
      onClearGuides?.();

      onUpdateBounds?.({
        x: currentSnappedX,
        y: currentSnappedY,
        width: currentSnappedW,
        height: currentSnappedH,
      });
      onCommitBounds?.();
    };

    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRotation = ((crop.rotation || 0) + 90) % 360;
    onUpdateCrop({ ...crop, rotation: nextRotation });
  };

  const handleScaleChange = (newScale: number) => {
    onUpdateCrop({ ...crop, scale: Math.max(1.0, Math.min(3.0, Number(newScale.toFixed(2)))) });
  };

  // 4. 鼠标滚轮悬停缩放（当画框被选中且包含照片时，滚动鼠标中键滚轮直接放大/缩小照片）
  useEffect(() => {
    const frameEl = frameRef.current;
    if (!frameEl || !photo || (!isSelected && !isEditingCrop)) return;

    const handleWheel = (e: WheelEvent) => {
      // 阻止浏览器和画布的默认滚动
      e.preventDefault();
      e.stopPropagation();

      const currentScale = crop.scale || 1.0;
      // deltaY > 0 为向下滚（缩小），deltaY < 0 为向上滚（放大）
      const zoomStep = 0.05;
      const direction = e.deltaY < 0 ? 1 : -1;
      const targetScale = Math.max(1.0, Math.min(3.0, Number((currentScale + direction * zoomStep).toFixed(2))));

      if (targetScale !== currentScale) {
        onUpdateCrop({
          ...crop,
          scale: targetScale,
        });
      }
    };

    // 使用 passive: false 确保能够成功执行 e.preventDefault() 拦截滚轮默认翻页
    frameEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      frameEl.removeEventListener('wheel', handleWheel);
    };
  }, [photo, isSelected, isEditingCrop, crop, onUpdateCrop]);

  // 动态根据页面基准分辨率 (2027 x 2027 px) 计算画框实际印刷像素尺寸
  const currentRenderX = localBounds?.x !== undefined ? localBounds.x : slot.x;
  const currentRenderY = localBounds?.y !== undefined ? localBounds.y : slot.y;
  const currentRenderW = localBounds?.width !== undefined ? localBounds.width : slot.width;
  const currentRenderH = localBounds?.height !== undefined ? localBounds.height : slot.height;

  const currentPixelW = Math.round((2027 * currentRenderW) / 100);
  const currentPixelH = Math.round((2027 * currentRenderH) / 100);
  const displayPixelText = `${currentPixelW}x${currentPixelH}`;

  // 黄金克制比例：根据画框尺寸平滑自适应，严控上下限，拒绝笨大与空小
  const placeholderScale = useMemo(() => {
    // 假设单页页面在屏幕上基准渲染宽高约为 460px x 460px
    const approxPixelWidth = (currentRenderW * 460) / 100;
    const approxPixelHeight = (currentRenderH * 460) / 100;
    const minDim = Math.min(approxPixelWidth, approxPixelHeight);
    
    // 平缓的自然过渡曲线：基础 0.75 + 随尺寸微调，封顶在 1.18x，保底在 0.72x
    const rawScale = 0.72 + (minDim / 380) * 0.46;
    return Math.max(0.72, Math.min(1.18, rawScale));
  }, [currentRenderW, currentRenderH]);

  // ========== 印刷清晰度与有效像素/DPI 检测系统 ==========
  const resolutionStatus = useMemo(() => {
    if (!photo || !photo.naturalWidth || !photo.naturalHeight) return null;

    // 1. 画框物理毫米与物理英寸尺寸
    const pageW_mm = bookSpec?.widthMm || 200;
    const pageH_mm = bookSpec?.heightMm || 200;
    const slotW_mm = (currentRenderW * pageW_mm) / 100;
    const slotH_mm = (currentRenderH * pageH_mm) / 100;
    const slotW_inch = Math.max(0.1, slotW_mm / 25.4);
    const slotH_inch = Math.max(0.1, slotH_mm / 25.4);

    // 2. 照片在旋转后的有效宽高
    const rot = (crop.rotation || 0) % 180;
    const photoOrigW = rot === 90 ? photo.naturalHeight : photo.naturalWidth;
    const photoOrigH = rot === 90 ? photo.naturalWidth : photo.naturalHeight;

    // 3. 计算用于填充当前画框区域的有效像素（考虑 scale 放大因素）
    // scale 越大，画框内截取的照片区域越小，有效像素越少
    const currentScale = Math.max(1.0, crop.scale || 1.0);
    const frameAspect = currentRenderW / Math.max(0.01, currentRenderH);
    const photoAspect = photoOrigW / Math.max(0.01, photoOrigH);

    let effectivePixelsW = photoOrigW;
    let effectivePixelsH = photoOrigH;

    if (photoAspect > frameAspect) {
      // 照片比画框更宽（左右被裁剪）
      effectivePixelsH = photoOrigH / currentScale;
      effectivePixelsW = effectivePixelsH * frameAspect;
    } else {
      // 照片比画框更高（上下被裁剪）
      effectivePixelsW = photoOrigW / currentScale;
      effectivePixelsH = effectivePixelsW / frameAspect;
    }

    // 4. 等效物理印刷 DPI
    const effectiveDpiW = effectivePixelsW / slotW_inch;
    const effectiveDpiH = effectivePixelsH / slotH_inch;
    const effectiveDpi = Math.round(Math.min(effectiveDpiW, effectiveDpiH));

    // 5. 判定等级：
    // < 150 DPI: 严重不足 (红色/深黄报警)
    // 150 ~ 199 DPI: 轻度不足 (黄色三角感叹号)
    // >= 200 DPI: 正常清晰
    const isLowResolution = effectiveDpi < 200;
    const isSevere = effectiveDpi < 150;

    return {
      isLowResolution,
      isSevere,
      effectiveDpi,
      effectivePixelsW: Math.round(effectivePixelsW),
      effectivePixelsH: Math.round(effectivePixelsH),
      neededPixelsW: currentPixelW,
      neededPixelsH: currentPixelH,
    };
  }, [photo, crop.scale, crop.rotation, currentRenderW, currentRenderH, bookSpec, currentPixelW, currentPixelH]);

  // ========== 文本框渲染 ==========
  if (slot.type === 'text') {
    return (
      <div
        ref={frameRef}
        id={`slot-text-${slot.id}`}
        style={{
          left: `${currentRenderX}%`,
          top: `${currentRenderY}%`,
          width: `${currentRenderW}%`,
          height: `${currentRenderH}%`,
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={handleStartMoveFrame}
        onDoubleClick={() => setIsEditingText(true)}
        className={`absolute flex items-center justify-center select-none ${
          isMovingFrame ? 'cursor-grabbing' : isSelected ? 'cursor-move' : 'cursor-default'
        } ${
          isSelected
            ? 'z-30'
            : 'hover:bg-neutral-100/40'
        }`}
      >
        {/* 选中时的 8 锚点外边框 (图帮主柔和风格) */}
        {isSelected && (
          <div className="absolute inset-0 pointer-events-none border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.22)] z-30">
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
                  onMouseDown={(e) => handleStartResize(e, handle)}
                  className={`absolute w-2.5 h-2.5 rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] pointer-events-auto z-40 ${handlePositions[handle]}`}
                  title="拖拽改变尺寸"
                />
              );
            })}

            {/* 4 条边中点：柔和圆角胶囊条 */}
            <div
              onMouseDown={(e) => handleStartResize(e, 'n')}
              className="absolute w-3.5 h-1.5 -top-[3px] left-1/2 -translate-x-1/2 rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ns-resize pointer-events-auto z-40"
              title="上下拉伸"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, 's')}
              className="absolute w-3.5 h-1.5 -bottom-[3px] left-1/2 -translate-x-1/2 rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ns-resize pointer-events-auto z-40"
              title="上下拉伸"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, 'w')}
              className="absolute w-1.5 h-3.5 top-1/2 -translate-y-1/2 -left-[3px] rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ew-resize pointer-events-auto z-40"
              title="左右拉伸"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, 'e')}
              className="absolute w-1.5 h-3.5 top-1/2 -translate-y-1/2 -right-[3px] rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ew-resize pointer-events-auto z-40"
              title="左右拉伸"
            />
          </div>
        )}

        {isEditingText ? (
          <div className="w-full h-full p-1 flex items-center" onMouseDown={(e) => e.stopPropagation()}>
            <input
              type="text"
              autoFocus
              value={textVal}
              placeholder={slot.placeholderText || '输入文字'}
              onChange={(e) => setTextVal(e.target.value)}
              onBlur={() => {
                setIsEditingText(false);
                onUpdateText?.(textVal);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingText(false);
                  onUpdateText?.(textVal);
                }
              }}
              className="w-full h-full px-2 text-xs bg-white border border-[#76383d] rounded shadow-xs outline-none text-neutral-800"
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center px-1">
            {slot.text ? (
              <span className="text-xs text-neutral-800 font-sans tracking-wide">
                {slot.text}
              </span>
            ) : (
              <div className="w-full h-full border border-neutral-300/80 bg-white/40 flex items-center justify-center px-2 py-0.5">
                <span className="text-[11px] text-neutral-600 font-sans select-none whitespace-nowrap">
                  {slot.placeholderText || '点两次输入文字(不输入文字不印刷)'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 选中时的浮动快捷操作栏 */}
        {isSelected && (
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white text-neutral-700 shadow-md border border-[#dadce0] rounded px-2 py-0.5 flex items-center space-x-1.5 z-40 text-xs"
          >
            <button
              onClick={() => setIsEditingText(true)}
              className="p-1 hover:bg-[#faf4f5] hover:text-[#76383d] rounded cursor-pointer"
              title="编辑文字"
            >
              编辑
            </button>
            <button
              onClick={onDuplicateSlot}
              className="p-1 hover:bg-[#faf4f5] hover:text-[#76383d] rounded cursor-pointer"
              title="复制此文本框"
            >
              <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={onDeleteSlot}
              className="p-1 hover:bg-[#faf4f5] hover:text-[#76383d] rounded cursor-pointer"
              title="删除此文本框"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ========== 照片画框渲染 (支持自由拖拽移动、拉伸与裁剪) ==========
  return (
    <div
      ref={frameRef}
      id={`slot-frame-${slot.id}`}
      style={{
        left: `${currentRenderX}%`,
        top: `${currentRenderY}%`,
        width: `${currentRenderW}%`,
        height: `${currentRenderH}%`,
        zIndex: isMovingFrame ? 45 : (isSelected && !hasMultipleSelection ? 30 : (zIndex !== undefined ? zIndex : 1)),
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={handleStartMoveFrame}
      onDoubleClick={() => photo && setIsEditingCrop(!isEditingCrop)}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`absolute group bg-[#e2e3e5] select-none ${
        isMovingFrame ? 'cursor-grabbing shadow-lg' : isSelected ? 'cursor-move' : 'cursor-default'
      } ${
        !isSelected && !isMultiSelected ? 'hover:outline hover:outline-1 hover:outline-neutral-400' : ''
      }`}
    >
      {/* 实时动态像素尺寸标注标签 (仅在未填充照片时显示，或在拉伸调整边框尺寸时提示) */}
      {(!photo || !!activeResizeHandle) && (
        <div className="absolute top-1.5 left-1.5 z-10 text-[9px] font-sans text-white/90 select-none pointer-events-none drop-shadow-xs leading-none tracking-tight">
          {displayPixelText}
        </div>
      )}

      {/* 照片渲染或占位图 */}
      <div className="w-full h-full relative overflow-hidden">
        {photo ? (
          <div
            className={`w-full h-full relative overflow-hidden flex items-center justify-center ${
              isEditingCrop ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            onMouseDown={isEditingCrop ? handleStartPan : undefined}
          >
            <div
              className={`w-full h-full relative overflow-hidden flex items-center justify-center ${
                isPanning ? 'transition-none' : 'transition-transform duration-75'
              }`}
              style={{
                transform: `scale(${crop.scale}) rotate(${crop.rotation}deg)`,
              }}
            >
              <img
                src={photo.url}
                alt={photo.name}
                referrerPolicy="no-referrer"
                style={{
                  objectPosition: `${crop.x}% ${crop.y}%`,
                  transform: `translate(${(50 - crop.x) * (crop.scale - 1) * 0.5}%, ${(50 - crop.y) * (crop.scale - 1) * 0.5}%)`,
                }}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            </div>

            {/* 1:1 米莫印品：当照片尺寸大于画框（存在裁剪溢出或缩放）时，居中常驻显示圆形小手图标徽章，可直接按住平移照片 */}
            {isPhotoOverflowing && (
              <div
                onMouseDown={handleStartPan}
                onClick={(e) => e.stopPropagation()}
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 transition-all select-none ${
                  isSelected || isEditingCrop || isPanning
                    ? 'opacity-100 scale-100 pointer-events-auto'
                    : 'opacity-0 group-hover:opacity-90 scale-95 hover:scale-100 pointer-events-auto'
                }`}
                title="按住拖拽调整照片在画框中的位置 (亦可直接滚动滚轮缩放)"
              >
                <div
                  className={`w-9 h-9 rounded-full bg-white/95 border border-[#333333] shadow-sm flex items-center justify-center transition-all ${
                    isPanning
                      ? 'cursor-grabbing scale-110 bg-white ring-2 ring-[#76383d]/40 shadow-md'
                      : 'cursor-grab hover:scale-105 hover:bg-white active:scale-95'
                  }`}
                >
                  <IconMemoHand isGrabbing={isPanning} />
                </div>
              </div>
            )}

            {/* 裁剪平移中半透明指示 */}
            {isEditingCrop && (
              <div className="absolute inset-0 border-2 border-dashed border-[#76383d] pointer-events-none bg-[#76383d]/10 flex items-center justify-center">
                <div className="bg-black/75 text-white text-[10px] px-2 py-1 rounded backdrop-blur-xs flex items-center space-x-1 shadow-md">
                  <Move className="w-3 h-3" />
                  <span>按住平移照片 · 双击完成</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 现代相册经典上下垂直布局：[ 📷 相机在上 + 拖照片至此添加在下 ] */
          <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none select-none overflow-hidden">
            <div
              style={{
                transform: `scale(${placeholderScale})`,
                transformOrigin: 'center center',
              }}
              className="flex flex-col items-center justify-center gap-1.5 text-[#5f6368] transition-transform"
            >
              <svg
                className="w-6 h-6 text-[#5f6368] shrink-0 transition-transform group-hover:scale-105"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* 饱满温润相机轮廓 (低趴平缓军舰部，告别高耸快门键，大圆角平滑过渡) */}
                <path d="M8.2 6.8L9.5 4.8C9.8 4.3 10.4 4 11 4H13C13.6 4 14.2 4.3 14.5 4.8L15.8 6.8H18.8C20 6.8 21 7.8 21 9V17.5C21 18.9 20 20 18.8 20H5.2C4 20 3 18.9 3 17.5V9C3 7.8 4 6.8 5.2 6.8H8.2Z" />
                {/* 镜头正圆：正中黄金落点 (cx: 12, cy: 13.5)，半径 3.3，内外留白匀称 */}
                <circle cx="12" cy="13.5" r="3.3" />
              </svg>
              <span
                style={{
                  fontWeight: 400,
                  fontFamily:
                    '"Yuanti SC", "STYuanti", "YouYuan", "幼圆", "Hiragino Maru Gothic ProN", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
                  letterSpacing: '0.05em',
                  WebkitFontSmoothing: 'antialiased',
                }}
                className="text-[11.5px] text-[#5f6368] leading-none select-none whitespace-nowrap"
              >
                拖拽照片至此处
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ⚠️ 像素分辨率检测预警徽章 (极简精致气泡，置于警告图标左侧，避开底部工具栏) */}
      {photo && resolutionStatus && resolutionStatus.isLowResolution && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-1.5 right-1.5 z-35 group/dpi pointer-events-auto cursor-help"
          title="图片清晰度不足"
        >
          <div className="transition-transform hover:scale-110 flex items-center justify-center p-0.5">
            <IconWarningTriangle isSevere={resolutionStatus.isSevere} />
          </div>

          {/* 悬停浮现的极简精致提示气泡 (向左侧展开，绝不遮挡底部工具栏) */}
          <div
            className="absolute right-full mr-2 bottom-0 w-max max-w-[220px] px-2.5 py-1.5 bg-neutral-900/95 text-white rounded-md shadow-xl text-[11px] leading-snug opacity-0 invisible group-hover/dpi:opacity-100 group-hover/dpi:visible transition-all duration-150 pointer-events-none z-[120] backdrop-blur-md border border-neutral-700/60"
          >
            {/* 指向警告图标的小三角尖角 */}
            <div className="absolute -right-1 bottom-1.5 w-2 h-2 bg-neutral-900/95 border-t border-r border-neutral-700/60 rotate-45 pointer-events-none" />

            <div className="flex items-start space-x-1.5">
              <span className="text-amber-400 font-bold shrink-0 mt-0.5">💡</span>
              <div className="text-neutral-200">
                {(slot.scale || 1) > 1.05 ? (
                  <span>
                    照片<strong className="text-amber-300 font-medium">放大后清晰度不足</strong>，建议<strong className="text-white underline underline-offset-2">缩小照片</strong>或更换原图
                  </span>
                ) : (
                  <span>
                    照片<strong className="text-amber-300 font-medium">像素不足</strong>影响印刷质量，建议更换更高清原图
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 选中画框时的 8 个调整尺寸手柄 + 底部旋转手柄 + 蓝色毫米尺寸/坐标浮动标签 (图帮主柔和风格) ========== */}
      {isSelected && !hasMultipleSelection && (
        <>
          {/* 柔和天蓝色毫米微型浮动标签 (#3c78d8) */}
          {isMovingFrame && (
            <div className="absolute top-1/2 -translate-y-1/2 left-[52%] z-60 bg-[#3c78d8] text-white text-[9.5px] font-sans px-1.5 py-0.5 rounded-[3px] shadow-xs pointer-events-none whitespace-nowrap leading-[13px] flex flex-col items-start select-none animate-fade-in tracking-tight">
              <div className="flex items-center space-x-1">
                <span className="opacity-95">X :</span>
                <span>
                  {((currentRenderX * (bookSpec?.widthMm || 200)) / 100).toFixed(2)}mm
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="opacity-95">Y :</span>
                <span>
                  {((currentRenderY * (bookSpec?.heightMm || 200)) / 100).toFixed(2)}mm
                </span>
              </div>
            </div>
          )}

          {activeResizeHandle && (
            <div className="absolute -top-7 left-2 z-60 bg-[#3c78d8] text-white text-[9.5px] font-sans px-1.5 py-0.5 rounded-[3px] shadow-xs pointer-events-none whitespace-nowrap leading-[13px] flex flex-col items-start select-none animate-fade-in tracking-tight">
              <div className="flex items-center space-x-1">
                <span className="opacity-95">宽 :</span>
                <span>
                  {((currentRenderW * (bookSpec?.widthMm || 200)) / 100).toFixed(2)}mm
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="opacity-95">高 :</span>
                <span>
                  {((currentRenderH * (bookSpec?.heightMm || 200)) / 100).toFixed(2)}mm
                </span>
              </div>
            </div>
          )}

          {/* 图帮主同款：选框外边框 (纯白发光细线，四角圆点 + 四边胶囊条 + 底部旋转手柄) */}
          <div className="absolute inset-0 pointer-events-none border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.22)] z-30">
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
                  onMouseDown={(e) => handleStartResize(e, handle)}
                  className={`absolute w-2.5 h-2.5 rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] pointer-events-auto z-40 ${handlePositions[handle]}`}
                  title="拖拽改变画框尺寸"
                />
              );
            })}

            {/* 4 条边中点：柔和圆角胶囊条 (长 14px，高 5px) */}
            <div
              onMouseDown={(e) => handleStartResize(e, 'n')}
              className="absolute w-3.5 h-1.5 -top-[3px] left-1/2 -translate-x-1/2 rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ns-resize pointer-events-auto z-40"
              title="上下拉伸"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, 's')}
              className="absolute w-3.5 h-1.5 -bottom-[3px] left-1/2 -translate-x-1/2 rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ns-resize pointer-events-auto z-40"
              title="上下拉伸"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, 'w')}
              className="absolute w-1.5 h-3.5 top-1/2 -translate-y-1/2 -left-[3px] rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ew-resize pointer-events-auto z-40"
              title="左右拉伸"
            />
            <div
              onMouseDown={(e) => handleStartResize(e, 'e')}
              className="absolute w-1.5 h-3.5 top-1/2 -translate-y-1/2 -right-[3px] rounded-full bg-white border border-neutral-300 shadow-[0_1px_3px_rgba(0,0,0,0.22)] cursor-ew-resize pointer-events-auto z-40"
              title="左右拉伸"
            />

            {/* 图帮主同款：底部中央圆形旋转把手 (带微小悬空与蓝色旋转弧线箭头) */}
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-40">
              <button
                type="button"
                onClick={handleRotate}
                className="w-5 h-5 rounded-full bg-white border border-neutral-200/90 shadow-[0_2px_5px_rgba(0,0,0,0.18)] flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-transform text-[#3c78d8]"
                title="顺时针旋转 90°"
              >
                <RotateCw className="w-2.5 h-2.5 stroke-[2.2]" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========== 选中画框时的浮动快捷工具栏 (仅在单选时显示，置于旋转按钮下方) ========== */}
      {isSelected && !hasMultipleSelection && (
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-white text-neutral-700 shadow-md border border-[#dadce0] rounded px-2 py-1 flex items-center space-x-1.5 z-40 backdrop-blur-xs whitespace-nowrap text-xs animate-fade-in"
        >
          {photo && (
            <>
              <button
                onClick={handleRotate}
                className="p-1 hover:bg-[#faf4f5] hover:text-[#76383d] rounded cursor-pointer"
                title="顺时针旋转 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => handleScaleChange(crop.scale - 0.1)}
                  className="p-0.5 hover:bg-[#faf4f5] rounded cursor-pointer"
                  title="缩小"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.05"
                  value={crop.scale}
                  onChange={(e) => handleScaleChange(Number(e.target.value))}
                  className="w-12 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#76383d]"
                />
                <button
                  onClick={() => handleScaleChange(crop.scale + 0.1)}
                  className="p-0.5 hover:bg-[#faf4f5] rounded cursor-pointer"
                  title="放大"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono text-neutral-500 w-8 text-right select-none">
                  {Math.round((crop.scale || 1.0) * 100)}%
                </span>
              </div>

              <div className="w-[1px] h-3 bg-neutral-200" />

              <button
                onClick={() => setIsEditingCrop(!isEditingCrop)}
                className={`p-1 rounded cursor-pointer ${
                  isEditingCrop ? 'bg-[#faf4f5] text-[#76383d]' : 'hover:bg-[#faf4f5] hover:text-[#76383d]'
                }`}
                title="调整画面重心"
              >
                <Move className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={onClearPhoto}
                className="p-1 hover:bg-[#faf4f5] text-neutral-500 hover:text-[#76383d] rounded cursor-pointer"
                title="清除照片 (保留画框)"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={onDuplicateSlot}
            className="p-1 hover:bg-[#faf4f5] hover:text-[#76383d] rounded cursor-pointer"
            title="复制此画框"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onDeleteSlot}
            className="p-1 hover:bg-[#faf4f5] text-neutral-500 hover:text-[#76383d] rounded cursor-pointer"
            title="删除画框"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
