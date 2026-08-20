import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SpreadModel, UploadedPhoto, EditorViewConfig, PhotoCrop, BookSpec, SpacingConfig, FixedGapConfig } from '../types/editor';
import { PhotoFrame } from './PhotoFrame';
import { MultiSelectBoundingBox } from './MultiSelectBoundingBox';
import { calculateMoveSnap, GuideLine, SpacingGap } from '../utils/snapEngine';
import { IconMultiPageGrid } from './MultiPageEditorModal';
import {
  Trash2,
  LayoutGrid,
  ArrowLeftRight,
  Layers,
  Copy,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Hand,
} from 'lucide-react';

interface SpreadCanvasProps {
  spread: SpreadModel;
  spreads?: SpreadModel[];
  currentSpreadIndex?: number;
  onSelectSpread?: (index: number) => void;
  onOpenMultiPage?: () => void;
  bookSpec: BookSpec;
  viewConfig: EditorViewConfig;
  onUpdateViewConfig?: (cfg: Partial<EditorViewConfig>) => void;
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
  onUpdateSlotProps?: (pageId: string, slotId: string, props: any) => void;
  onBringForward?: (pageId: string, slotId: string) => void;
  onSendBackward?: (pageId: string, slotId: string) => void;
  onBringToFront?: (pageId: string, slotId: string) => void;
  onSendToBack?: (pageId: string, slotId: string) => void;
  onMakeFullScreen?: (pageId: string, slotId: string) => void;
  onLocatePhoto?: (photoId: string) => void;
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
  onOpenSwapPhotoModal?: (slotId: string) => void;
  onSwapPhotos?: (slotIdA: string, slotIdB: string) => void;
  onSwapSpreadPagePhotos?: () => void;
  onOpenLayoutDrawer: (page: 'left' | 'right') => void;
  onClearPagePhotos: (page: 'left' | 'right') => void;
}

export const SpreadCanvas: React.FC<SpreadCanvasProps> = ({
  spread,
  spreads = [],
  currentSpreadIndex = 0,
  onSelectSpread,
  onOpenMultiPage,
  bookSpec,
  viewConfig,
  onUpdateViewConfig,
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
  onUpdateSlotProps,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onMakeFullScreen,
  onLocatePhoto,
  onUpdateSlotText,
  onUpdateSlotBounds,
  onUpdateMultipleSlotsBounds,
  onCommitSlotBounds,
  onDeleteSlot,
  onDeleteMultipleSlots,
  onDuplicateSlot,
  onOpenSwapPhotoModal,
  onSwapPhotos,
  onSwapSpreadPagePhotos,
  onOpenLayoutDrawer,
  onClearPagePhotos,
}) => {
  const photoMap = new Map<string, UploadedPhoto>(photos.map((p) => [p.id, p]));
  
  // 工作区容器引用与自适应最佳满屏比例计算
  const containerRef = useRef<HTMLElement>(null);
  const [fitScale, setFitScale] = useState<number>(1);

  useEffect(() => {
    const updateFitScale = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth <= 0 || clientHeight <= 0) return;

      // 留出适度安全边距 (左右 56px，上下留出底部浮动控制栏约 96px 边距)
      const availableWidth = Math.max(200, clientWidth - 56);
      const availableHeight = Math.max(150, clientHeight - 96);
      const bookWidth = 920;
      const bookHeight = 460;

      const scaleX = availableWidth / bookWidth;
      const scaleY = availableHeight / bookHeight;
      const computedFit = Math.min(scaleX, scaleY);
      if (computedFit > 0) {
        setFitScale(computedFit);
      }
    };

    updateFitScale();
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(updateFitScale);
    observer.observe(el);
    window.addEventListener('resize', updateFitScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateFitScale);
    };
  }, []);

  // 缩放比例：最左侧 100% 严格对应最佳适屏满屏比例 (fitScale)，向右拖动则在此基础上平滑放大
  const zoomMultiplier = (viewConfig.zoomPercent || 100) / 100;
  const finalScale = fitScale * zoomMultiplier;
  // 发丝级极致细线补偿
  const hairlineThickness = Math.max(0.5, 0.75 / finalScale);

  const leftSelectedSlots = spread.leftPage.slots.filter((s) => selectedSlotIds.includes(s.id));
  const rightSelectedSlots = spread.rightPage.slots.filter((s) => selectedSlotIds.includes(s.id));

  // 智能对齐辅助线 (红线：边缘对齐；黄线：中轴对齐)
  const [leftGuides, setLeftGuides] = useState<GuideLine[]>([]);
  const [leftGaps, setLeftGaps] = useState<SpacingGap[]>([]);
  const [rightGuides, setRightGuides] = useState<GuideLine[]>([]);
  const [rightGaps, setRightGaps] = useState<SpacingGap[]>([]);

  // 抓手移动画板状态 (小手工具 & 空格快捷键)
  const [isHandToolActive, setIsHandToolActive] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);

  // 监听空格键按住临时激活抓手移动
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        !isSpacePressed &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  // 计算当前跨页的页码显示文本 (如 12 — 13 或 封面)
  const pageLabel = useMemo(() => {
    const leftNum = spread.leftPage.pageNumber;
    const rightNum = spread.rightPage.pageNumber;
    if (leftNum === 0 && rightNum === 0) return '封面';
    if (!leftNum && !rightNum) return '封面';
    if (leftNum && !rightNum) return `P${leftNum}`;
    if (!leftNum && rightNum) return `P${rightNum}`;
    return `${leftNum} — ${rightNum}`;
  }, [spread]);

  const canPrevSpread = currentSpreadIndex > 0;
  const canNextSpread = spreads.length > 0 ? currentSpreadIndex < spreads.length - 1 : false;

  // Adobe Illustrator 风格相交框选（Crossing/Intersect Marquee Selection）状态
  const [marqueeBox, setMarqueeBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // 照片互换拖拽悬停状态 (按住左上角蓝色图标拖拽对调)
  const [swapDragState, setSwapDragState] = useState<{
    sourceSlotId: string;
    sourcePageId: string;
    photo?: UploadedPhoto;
    mouseX: number;
    mouseY: number;
    hoverSlotId: string | null;
  } | null>(null);

  // 启动按住图标拖拽对调照片 (手势大于3px触发对调，单击触发选图弹窗)
  const handleStartPhotoSwapDrag = (
    e: React.MouseEvent,
    pageId: string,
    slotId: string,
    photo?: UploadedPhoto
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    let isDragging = false;

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const dist = Math.hypot(moveEvt.clientX - startX, moveEvt.clientY - startY);
      if (!isDragging && dist > 3) {
        isDragging = true;
      }

      if (isDragging) {
        // 动态探测鼠标指针下方的相框元素
        const elementsUnder = document.elementsFromPoint(moveEvt.clientX, moveEvt.clientY);
        let foundSlotId: string | null = null;
        for (const el of elementsUnder) {
          const slotEl = el.closest('[id^="slot-frame-"]');
          if (slotEl) {
            const id = slotEl.id.replace('slot-frame-', '');
            if (id && id !== slotId) {
              foundSlotId = id;
              break;
            }
          }
        }

        setSwapDragState({
          sourceSlotId: slotId,
          sourcePageId: pageId,
          photo,
          mouseX: moveEvt.clientX,
          mouseY: moveEvt.clientY,
          hoverSlotId: foundSlotId,
        });
      }
    };

    const handleMouseUp = (upEvt: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);

      if (isDragging) {
        // 寻找最终落点的目标画框
        const elementsUnder = document.elementsFromPoint(upEvt.clientX, upEvt.clientY);
        let targetSlotId: string | null = null;
        for (const el of elementsUnder) {
          const slotEl = el.closest('[id^="slot-frame-"]');
          if (slotEl) {
            const id = slotEl.id.replace('slot-frame-', '');
            if (id && id !== slotId) {
              targetSlotId = id;
              break;
            }
          }
        }

        if (targetSlotId && onSwapPhotos) {
          onSwapPhotos(slotId, targetSlotId);
        }
        setSwapDragState(null);
      } else {
        // 纯点击没有拖拽位移：静默退出，不弹任何对话框
        setSwapDragState(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

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

  // --- Adobe Illustrator 风格相交框选 / 抓手移动画板 ---
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // 仅响应鼠标左键
    if (e.button !== 0) return;

    // 若开启了抓手工具或按住了空格键，启动画布平移拖拽 (Pan Tool)
    if (isHandToolActive || isSpacePressed) {
      e.preventDefault();
      setIsPanning(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const initPanX = panOffset.x;
      const initPanY = panOffset.y;

      const handlePanMove = (moveEvt: MouseEvent) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;
        setPanOffset({
          x: initPanX + dx,
          y: initPanY + dy,
        });
      };

      const handlePanUp = () => {
        setIsPanning(false);
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanUp);
      };

      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanUp);
      return;
    }

    const target = e.target as HTMLElement;
    // 如果点击在按钮、输入框、调整尺寸的手柄或画框本体上，不启动画布框选
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('[title="拖拽改变尺寸"]') ||
      target.closest('[title="上下拉伸"]') ||
      target.closest('[title="左右拉伸"]') ||
      target.closest('[id^="slot-frame-"]') ||
      target.closest('#canvas-bottom-floating-controlbar')
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
      ref={containerRef}
      onMouseDown={handleCanvasMouseDown}
      onClick={(e) => {
        // 点击画板外部背景时取消单页/画框选中 (抓手状态下不取消)
        if (isHandToolActive || isSpacePressed) return;
        if (e.target === e.currentTarget) {
          onSelectSlot(null);
          onSelectSide(null);
        }
      }}
      className={`flex-1 bg-[#ededf0] overflow-auto flex items-center justify-center p-4 md:p-8 select-none relative ${
        isPanning
          ? 'cursor-grabbing'
          : isHandToolActive || isSpacePressed
          ? 'cursor-grab'
          : 'cursor-default'
      }`}
      style={{
        backgroundImage: viewConfig.showGrid
          ? 'radial-gradient(#d3d5d9 1px, transparent 1px)'
          : undefined,
        backgroundSize: '20px 20px',
      }}
    >
      {/* 缩放画板包装层 (支持小手工具自由平移和居中自适应缩放) */}
      <div
        id="spread-scale-container"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${finalScale})`,
          transformOrigin: 'center center',
          transition: isPanning ? 'none' : 'transform 0.15s ease-out',
        }}
        className="flex items-center justify-center relative py-8 px-6 isolate shrink-0"
      >
        {/* 双页展开书本体 (标准双页比例，自适应视口完整展示) */}
        <div
          id="double-page-spread-book"
          className="flex shadow-[0_4px_24px_rgba(0,0,0,0.08)] bg-white relative rounded-xs border border-[#dadce0] shrink-0"
          style={{
            width: '920px',
            height: '460px',
          }}
        >
          {/* ========== 左页 ========== */}
          <div
            id={`page-left-${spread.leftPage.id}`}
            onMouseDown={() => {
              onSelectSide('left');
            }}
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
            {/* 3mm 印刷裁切安全线 (四周虚线，中间中缝不加虚线：左页仅上、下、左三边带细虚线，置顶 z-[65] 确保满版图也清晰可见) */}
            {viewConfig.showBleed && (
              <div className="absolute inset-0 pointer-events-none z-[65] overflow-hidden">
                <svg className="w-full h-full" style={{ display: 'block' }}>
                  {/* 左页顶部虚线 (从左 7px 到右侧中缝) */}
                  <line
                    x1="7"
                    y1="7"
                    x2="100%"
                    y2="7"
                    stroke="#d89ba0"
                    strokeWidth={hairlineThickness}
                    strokeDasharray="2.5 2.5"
                    opacity="0.85"
                  />
                  {/* 左页左侧外边缘虚线 */}
                  <line
                    x1="7"
                    y1="7"
                    x2="7"
                    y2="calc(100% - 7px)"
                    stroke="#d89ba0"
                    strokeWidth={hairlineThickness}
                    strokeDasharray="2.5 2.5"
                    opacity="0.85"
                  />
                  {/* 左页底部虚线 (从左 7px 到右侧中缝) */}
                  <line
                    x1="7"
                    y1="calc(100% - 7px)"
                    x2="100%"
                    y2="calc(100% - 7px)"
                    stroke="#d89ba0"
                    strokeWidth={hairlineThickness}
                    strokeDasharray="2.5 2.5"
                    opacity="0.85"
                  />
                </svg>
              </div>
            )}

            {/* 安全裁切区虚线 */}
            {viewConfig.showSafeZone && (
              <div className="absolute inset-4 border border-dashed border-emerald-400/30 pointer-events-none z-[65]" />
            )}

            {/* 左页槽位列表 */}
            <div className="w-full h-full relative">
              {spread.leftPage.slots.map((slot, index) => (
                <PhotoFrame
                  key={slot.id}
                  slot={slot}
                  zIndex={slot.zIndex !== undefined ? slot.zIndex : index + 1}
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
                  onUpdateSlotProps={(props) =>
                    onUpdateSlotProps?.(spread.leftPage.id, slot.id, props)
                  }
                  onBringForward={() => onBringForward?.(spread.leftPage.id, slot.id)}
                  onSendBackward={() => onSendBackward?.(spread.leftPage.id, slot.id)}
                  onBringToFront={() => onBringToFront?.(spread.leftPage.id, slot.id)}
                  onSendToBack={() => onSendToBack?.(spread.leftPage.id, slot.id)}
                  onMakeFullScreen={() => onMakeFullScreen?.(spread.leftPage.id, slot.id)}
                  onLocatePhoto={onLocatePhoto}
                  onUpdateText={(text) =>
                    onUpdateSlotText?.(spread.leftPage.id, slot.id, text)
                  }
                  onUpdateBounds={(bounds) =>
                    onUpdateSlotBounds?.(spread.leftPage.id, slot.id, bounds)
                  }
                  onCommitBounds={onCommitSlotBounds}
                  onDeleteSlot={() => onDeleteSlot?.(spread.leftPage.id, slot.id)}
                  onDuplicateSlot={() => onDuplicateSlot?.(spread.leftPage.id, slot.id)}
                  onStartSwapDrag={(e) =>
                    handleStartPhotoSwapDrag(
                      e,
                      spread.leftPage.id,
                      slot.id,
                      slot.photoId ? photoMap.get(slot.photoId) : undefined
                    )
                  }
                  isSwapTargetHovered={swapDragState?.hoverSlotId === slot.id}
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

            {/* ========== 1:1 还原：在左半面操作/选中左页时的柔淡豆沙酒红高亮外框 (外嵌在版面外侧，上、左、下三边包围，中缝无垂直分割线，2px 精致线条，z-[70] 置顶) ========== */}
            {activeSide === 'left' && (
              <div className="absolute -top-[2px] -bottom-[2px] -left-[2px] right-0 pointer-events-none z-[70] border-t-2 border-b-2 border-l-2 border-r-0 border-[#c48489] shadow-[-1px_0_0_0_rgba(118,56,61,0.2)]" />
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
                  activeSide === 'left'
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
            onMouseDown={() => {
              onSelectSide('right');
            }}
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
            {/* 3mm 印刷裁切安全线 (四周虚线，中间中缝不加虚线：右页仅上、下、右三边带细虚线，置顶 z-[65] 确保满版图也清晰可见) */}
            {viewConfig.showBleed && (
              <div className="absolute inset-0 pointer-events-none z-[65] overflow-hidden">
                <svg className="w-full h-full" style={{ display: 'block' }}>
                  {/* 右页顶部虚线 (从中缝到右侧 7px 处) */}
                  <line
                    x1="0"
                    y1="7"
                    x2="calc(100% - 7px)"
                    y2="7"
                    stroke="#d89ba0"
                    strokeWidth={hairlineThickness}
                    strokeDasharray="2.5 2.5"
                    opacity="0.85"
                  />
                  {/* 右页右侧外边缘虚线 */}
                  <line
                    x1="calc(100% - 7px)"
                    y1="7"
                    x2="calc(100% - 7px)"
                    y2="calc(100% - 7px)"
                    stroke="#d89ba0"
                    strokeWidth={hairlineThickness}
                    strokeDasharray="2.5 2.5"
                    opacity="0.85"
                  />
                  {/* 右页底部虚线 (从中缝到右侧 7px 处) */}
                  <line
                    x1="0"
                    y1="calc(100% - 7px)"
                    x2="calc(100% - 7px)"
                    y2="calc(100% - 7px)"
                    stroke="#d89ba0"
                    strokeWidth={hairlineThickness}
                    strokeDasharray="2.5 2.5"
                    opacity="0.85"
                  />
                </svg>
              </div>
            )}

            {/* 安全裁切区虚线 */}
            {viewConfig.showSafeZone && (
              <div className="absolute inset-4 border border-dashed border-emerald-400/30 pointer-events-none z-[65]" />
            )}

            {/* 右页槽位列表 */}
            <div className="w-full h-full relative">
              {spread.rightPage.slots.map((slot, index) => (
                <PhotoFrame
                  key={slot.id}
                  slot={slot}
                  zIndex={slot.zIndex !== undefined ? slot.zIndex : index + 1}
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
                  onUpdateSlotProps={(props) =>
                    onUpdateSlotProps?.(spread.rightPage.id, slot.id, props)
                  }
                  onBringForward={() => onBringForward?.(spread.rightPage.id, slot.id)}
                  onSendBackward={() => onSendBackward?.(spread.rightPage.id, slot.id)}
                  onBringToFront={() => onBringToFront?.(spread.rightPage.id, slot.id)}
                  onSendToBack={() => onSendToBack?.(spread.rightPage.id, slot.id)}
                  onMakeFullScreen={() => onMakeFullScreen?.(spread.rightPage.id, slot.id)}
                  onLocatePhoto={onLocatePhoto}
                  onUpdateText={(text) =>
                    onUpdateSlotText?.(spread.rightPage.id, slot.id, text)
                  }
                  onUpdateBounds={(bounds) =>
                    onUpdateSlotBounds?.(spread.rightPage.id, slot.id, bounds)
                  }
                  onCommitBounds={onCommitSlotBounds}
                  onDeleteSlot={() => onDeleteSlot?.(spread.rightPage.id, slot.id)}
                  onDuplicateSlot={() => onDuplicateSlot?.(spread.rightPage.id, slot.id)}
                  onStartSwapDrag={(e) =>
                    handleStartPhotoSwapDrag(
                      e,
                      spread.rightPage.id,
                      slot.id,
                      slot.photoId ? photoMap.get(slot.photoId) : undefined
                    )
                  }
                  isSwapTargetHovered={swapDragState?.hoverSlotId === slot.id}
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

            {/* ========== 1:1 还原：在右半面操作/选中右页时的柔淡豆沙酒红高亮外框 (外嵌在版面外侧，上、右、下三边包围，中缝无垂直分割线，2px 精致线条，z-[70] 置顶) ========== */}
            {activeSide === 'right' && (
              <div className="absolute -top-[2px] -bottom-[2px] left-0 -right-[2px] pointer-events-none z-[70] border-t-2 border-b-2 border-r-2 border-l-0 border-[#c48489] shadow-[1px_0_0_0_rgba(118,56,61,0.2)]" />
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
                  activeSide === 'right'
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

            {/* 左页间隙高亮 (已根据需求移除 2mm 等气泡标签与色块，保持纯净对齐辅助线) */}
            {/* 右页间隙高亮 (同上) */}
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

        {/* ========== 多选时出现在下方的精简浮动操作工具栏 ========== */}
        {selectedSlotIds.length >= 2 && (
          <div
            id="multi-selection-floating-toolbar"
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white border border-[#dadce0] rounded-md shadow-lg px-2.5 py-1.5 flex items-center space-x-2.5 text-neutral-700 text-xs z-50 animate-fade-in select-none"
          >
            <span className="text-[11px] font-medium text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
              已选中 {selectedSlotIds.length} 个画框
            </span>

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

      {/* ========== 拖拽互换照片时跟随光标的极简照片缩略预览 (Ghost Preview) ========== */}
      {swapDragState && swapDragState.photo && (
        <div
          id="swap-drag-ghost-preview"
          className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 select-none animate-fade-in"
          style={{
            left: `${swapDragState.mouseX}px`,
            top: `${swapDragState.mouseY}px`,
          }}
        >
          <div className="relative w-12 h-12 rounded-lg overflow-hidden shadow-2xl border-2 border-white ring-2 ring-black/20 bg-neutral-800">
            <img
              src={
                swapDragState.photo.previewUrl ||
                swapDragState.photo.thumbnailUrl ||
                swapDragState.photo.thumbUrl ||
                swapDragState.photo.url
              }
              alt=""
              className="w-full h-full object-cover"
            />
            {/* 右下角黑白对调角标 */}
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white text-neutral-800 flex items-center justify-center border border-neutral-200 shadow-sm">
              <ArrowLeftRight className="w-2.5 h-2.5 stroke-[2.5]" />
            </div>
          </div>
        </div>
      )}

      {/* ========== 底部悬浮控制栏：页码显示与切换 + 缩放控制 + 抓手移动工具 (1:1 还原用户参考图比例与大号胶囊) ========== */}
      <div
        id="canvas-bottom-floating-controlbar"
        className="fixed bottom-7 left-1/2 -translate-x-1/2 z-40 flex items-center space-x-2.5 select-none animate-fade-in pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 左侧胶囊：页码切换与显示 [ ← | 4 — 5 | → ] */}
        <div className="bg-white border border-[#dadce0] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] h-12 px-2 flex items-center text-neutral-800">
          <button
            type="button"
            id="btn-bottom-prev-page"
            disabled={!canPrevSpread}
            onClick={() => onSelectSpread?.(Math.max(0, currentSpreadIndex - 1))}
            className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors ${
              canPrevSpread ? 'text-neutral-700 hover:text-[#76383d] cursor-pointer' : 'text-neutral-300 cursor-not-allowed'
            }`}
            title="上一跨页"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-[1px] h-6 bg-[#eaedf0] mx-1" />

          {/* 页码显示 (如 4 — 5 或 封面，清晰大字号) */}
          <span className="text-base font-medium text-[#202124] px-4 min-w-[80px] text-center tracking-wide font-sans">
            {pageLabel}
          </span>

          <div className="w-[1px] h-6 bg-[#eaedf0] mx-1" />

          <button
            type="button"
            id="btn-bottom-next-page"
            disabled={!canNextSpread}
            onClick={() => onSelectSpread?.(Math.min(spreads.length - 1, currentSpreadIndex + 1))}
            className={`w-9 h-9 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors ${
              canNextSpread ? 'text-neutral-700 hover:text-[#76383d] cursor-pointer' : 'text-neutral-300 cursor-not-allowed'
            }`}
            title="下一跨页"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* 中间胶囊：缩放控制 [ ⊖ | ●──────── | ⊕ ] */}
        <div className="bg-white border border-[#dadce0] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] h-12 px-3 flex items-center space-x-1.5 text-neutral-600">
          <button
            type="button"
            id="btn-bottom-zoom-out"
            disabled={(viewConfig.zoomPercent || 100) <= 100}
            onClick={() => onUpdateViewConfig?.({ zoomPercent: Math.max(100, (viewConfig.zoomPercent || 100) - 10) })}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
              (viewConfig.zoomPercent || 100) <= 100
                ? 'text-neutral-300 cursor-not-allowed'
                : 'hover:bg-neutral-100 hover:text-[#76383d] text-neutral-600 cursor-pointer'
            }`}
            title="缩小至最佳满屏"
          >
            <ZoomOut className="w-5 h-5" />
          </button>

          <div className="w-[1px] h-6 bg-[#eaedf0] mx-1" />

          {/* 缩放滑块 (100% ~ 180% 范围，默认 100% 处于最左侧，对应最佳满屏) */}
          <div className="px-2.5 flex items-center">
            <input
              type="range"
              min="100"
              max="180"
              step="5"
              value={viewConfig.zoomPercent || 100}
              onChange={(e) => onUpdateViewConfig?.({ zoomPercent: Number(e.target.value) })}
              className="mimo-zoom-slider w-36 cursor-pointer"
              title={(viewConfig.zoomPercent || 100) <= 100 ? '当前状态：最佳满屏 (适屏)' : `放大比例: ${viewConfig.zoomPercent}%`}
            />
          </div>

          <div className="w-[1px] h-6 bg-[#eaedf0] mx-1" />

          <button
            type="button"
            id="btn-bottom-zoom-in"
            disabled={(viewConfig.zoomPercent || 100) >= 180}
            onClick={() => onUpdateViewConfig?.({ zoomPercent: Math.min(180, (viewConfig.zoomPercent || 100) + 10) })}
            className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors ${
              (viewConfig.zoomPercent || 100) >= 180
                ? 'text-neutral-300 cursor-not-allowed'
                : 'hover:bg-neutral-100 hover:text-[#76383d] text-neutral-600 cursor-pointer'
            }`}
            title="放大查看细节"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>

        {/* 右侧胶囊：小手抓手移动设计区域 [ ✋ ] */}
        <button
          type="button"
          id="btn-bottom-hand-tool"
          onClick={() => setIsHandToolActive(!isHandToolActive)}
          className={`h-12 w-12 rounded-xl border shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-center justify-center transition-all cursor-pointer ${
            isHandToolActive
              ? 'bg-[#faf4f5] text-[#76383d] border-[#d8b9be] ring-2 ring-[#76383d]/40'
              : 'bg-white text-neutral-600 border-[#dadce0] hover:bg-neutral-50 hover:text-neutral-900'
          }`}
          title={
            isHandToolActive
              ? '抓手移动模式已开启 (按住鼠标左键可拖拽移动设计区，按空格键也可临时拖拽)'
              : '抓手工具：点击开启拖拽移动设计区 (快捷键：空格键)'
          }
        >
          <Hand className="w-5 h-5" />
        </button>

        {/* 极速多页编辑按钮 (1:1 还原用户上传图 1 的酒红微标与图邦主多页总览入口) */}
        {onOpenMultiPage && (
          <button
            type="button"
            id="btn-bottom-multi-page-view"
            onClick={onOpenMultiPage}
            className="h-12 px-3 bg-white hover:bg-neutral-50 active:bg-neutral-100 border border-[#dadce0] rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-center space-x-2 transition-all cursor-pointer group"
            title="打开多页编辑与总览视图 (图邦主多页平铺模式)"
          >
            <div className="w-8 h-8 rounded-lg bg-[#76383d] text-white flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <IconMultiPageGrid className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-semibold text-neutral-700 group-hover:text-[#76383d] transition-colors pr-1">
              多页编辑
            </span>
          </button>
        )}
      </div>
    </main>
  );
};
