import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  ArrowLeftRight,
  FlipHorizontal,
  Maximize,
  Layers,
  ChevronsUp,
  ChevronsDown,
  Shapes,
  Square,
  Sparkles,
  Search,
  Check,
  Palette,
  SlidersHorizontal,
  Sun,
  Maximize2,
  Scan,
} from 'lucide-react';
import {
  FrameSlot,
  UploadedPhoto,
  PhotoCrop,
  BookSpec,
  SpacingConfig,
  FixedGapConfig,
  MaskShape,
  FitMode,
} from '../types/editor';
import {
  calculateMoveSnap,
  calculateResizeSnap,
  calculateProportionalResizeSnap,
  GuideLine,
  SpacingGap,
} from '../utils/snapEngine';
import {
  MOMO_MASK_DEFINITIONS,
  getMomoMaskStyle,
} from '../utils/masks';

// 1:1 精准复刻：舒展四向实心移动箭头 (长十字柄 + 锐利分离箭头，绝不粘连挤压)
const IconMoveCross: React.FC<{ className?: string }> = ({ className = 'w-4.5 h-4.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M 12 1.5 L 16.2 6.5 H 13.2 V 10.8 H 17.5 V 7.8 L 22.5 12 L 17.5 16.2 V 13.2 H 13.2 V 17.5 H 16.2 L 12 22.5 L 7.8 17.5 H 10.8 V 13.2 H 6.5 V 16.2 L 1.5 12 L 6.5 7.8 V 10.8 H 10.8 V 6.5 H 7.8 Z" />
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

// 左右对调双向箭头图标 (精致细腻、圆润倒角、间距舒适)
const IconHorizontalSwapArrows: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.55"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M 3.8 5.8 H 15.8" />
    <path d="M 12 2.2 L 15.8 5.8 L 12 9.4" />
    <path d="M 16.2 14.2 H 4.2" />
    <path d="M 8 10.6 L 4.2 14.2 L 8 17.8" />
  </svg>
);

// 适应照片框图标 (取景框四角 + 居中圆角小方块，1:1 精确复刻)
const IconFitFrame: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    {/* 四个圆角取景拐角 */}
    <path
      d="M4 8.5V6a2 2 0 0 1 2-2h2.5 M15.5 4H18a2 2 0 0 1 2 2v2.5 M20 15.5V18a2 2 0 0 1-2 2h-2.5 M8.5 20H6a2 2 0 0 1-2-2v-2.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* 居中圆角实心矩形 */}
    <rect
      x="7.5"
      y="7.5"
      width="9"
      height="9"
      rx="2"
      fill="currentColor"
    />
  </svg>
);

// 米莫风格水平翻转图标：左右相对双三角形 + 中间垂直虚线镜像轴 (左镂空、右实心)
const IconFlipHorizontalMomo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    {/* 中间垂直虚线镜像轴 */}
    <line x1="12" y1="3.5" x2="12" y2="20.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2" strokeLinecap="round" />
    {/* 左侧线框三角 */}
    <polygon points="4,6 10,12 4,18" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
    {/* 右侧实心三角 */}
    <polygon points="20,6 14,12 20,18" fill="currentColor" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

// 米莫风格满屏图标 (四个圆角取景拐角)
const IconFullScreenMomo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 9V6a2 2 0 0 1 2-2h3" />
    <path d="M20 9V6a2 2 0 0 0-2-2h-3" />
    <path d="M4 15v3a2 2 0 0 0 2 2h3" />
    <path d="M20 15v3a2 2 0 0 1-2 2h-3" />
  </svg>
);

// 米莫风格遮罩图标 (外层细线圆角方形框 + 内层圆形 + 圆内 45° 精致细密网纹排线，无十字锚点)
const IconMaskMomo: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    {/* 外层细线圆角方形框 */}
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
    {/* 中间正圆 */}
    <circle cx="12" cy="12" r="5.2" stroke="currentColor" strokeWidth="1.2" />
    {/* 圆内 45° 交叉细密网纹 (裁剪在圆内，精细 0.75px 线条) */}
    <g clipPath="url(#momo-icon-mask-clip)">
      <line x1="6.5" y1="9" x2="15" y2="17.5" stroke="currentColor" strokeWidth="0.75" />
      <line x1="8" y1="7" x2="17" y2="16" stroke="currentColor" strokeWidth="0.75" />
      <line x1="10" y1="6.5" x2="17.5" y2="14" stroke="currentColor" strokeWidth="0.75" />
      <line x1="6.5" y1="12" x2="12" y2="17.5" stroke="currentColor" strokeWidth="0.75" />
      <line x1="12" y1="6.5" x2="17.5" y2="12" stroke="currentColor" strokeWidth="0.75" />

      <line x1="15" y1="6.5" x2="6.5" y2="15" stroke="currentColor" strokeWidth="0.75" />
      <line x1="17" y1="8" x2="7" y2="18" stroke="currentColor" strokeWidth="0.75" />
      <line x1="17.5" y1="10" x2="10" y2="17.5" stroke="currentColor" strokeWidth="0.75" />
      <line x1="12" y1="6.5" x2="6.5" y2="12" stroke="currentColor" strokeWidth="0.75" />
      <line x1="17.5" y1="12" x2="12" y2="17.5" stroke="currentColor" strokeWidth="0.75" />
    </g>
    <defs>
      <clipPath id="momo-icon-mask-clip">
        <circle cx="12" cy="12" r="4.8" />
      </clipPath>
    </defs>
  </svg>
);

// 米莫风格边框宽度图标 (内外双层方形线框)
const IconBorderWidthMomo: React.FC<{ className?: string }> = ({ className = 'w-5.5 h-5.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="1.5" />
    <rect x="6.5" y="6.5" width="11" height="11" rx="0.5" />
  </svg>
);

// 米莫风格边框颜色图标 (经典水滴/色滴)
const IconBorderColorMomo: React.FC<{ className?: string }> = ({ className = 'w-5.5 h-5.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

// 米莫风格边框圆角图标 (大圆角矩形，右上角饱满大弧度，无杂质虚线)
const IconBorderRadiusMomo: React.FC<{ className?: string }> = ({ className = 'w-5.5 h-5.5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3.5 3.5h7.5a9.5 9.5 0 0 1 9.5 9.5v7.5h-17V3.5z" />
  </svg>
);

// 颜色转换辅助函数 (HEX <-> HSV)
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let c = (hex || '#ffffff').replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c || 'ffffff', 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s: Math.round(s * 100), v: Math.round(v * 100) };
}

function hsvToHex(h: number, s: number, v: number): string {
  const sat = s / 100;
  const val = v / 100;
  const i = Math.floor((h / 60) % 6);
  const f = h / 60 - i;
  const p = val * (1 - sat);
  const q = val * (1 - f * sat);
  const t = val * (1 - (1 - f) * sat);
  let r = 0;
  let g = 0;
  let b = 0;
  switch (i) {
    case 0: r = val; g = t; b = p; break;
    case 1: r = q; g = val; b = p; break;
    case 2: r = p; g = val; b = t; break;
    case 3: r = p; g = q; b = val; break;
    case 4: r = t; g = p; b = val; break;
    case 5: r = val; g = p; b = q; break;
  }
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// 常用调色板与主题色配置 (1:1 精准对应米莫印品)
const MOMO_THEME_COLORS = [
  '#fbece4', '#d4f1f4', '#faf5eb', '#ebd067', '#3d4b66', '#56657f', '#faf8f5'
];

const MOMO_COMMON_COLORS = [
  '#ffffff', '#000000', '#dd0061', '#009fe8', '#b8a793', '#8da2af', '#eea38f', '#50718d', '#eca800',
  '#eb6100', '#d81e06', '#70b603', '#bae5f8', '#5a3825', '#921b1d', '#134f2c', '#fdf08a', '#f6d38b',
  '#a6d743'
];

const BORDER_WIDTH_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
const BORDER_RADIUS_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 40, 50];

// 米莫印品标准点数 (pt) 转画布预览像素 (px) 精确比例换算
// 1 pt ≈ 0.44px (在 6 点时呈现约 2.6px 精致画框描边，与米莫印刷编辑器 1:1 视觉对齐)
export const getMomoBorderWidthPx = (pt?: number): number => {
  if (!pt || pt <= 0) return 0;
  return Math.round(pt * 0.44 * 10) / 10;
};

// 米莫风格两级颜色拾取气泡弹窗 (左侧常用色盘位置固定，点“更多颜色...”在右侧原位平滑扩展调色板)
const MomoColorPickerPopover: React.FC<{
  currentColor: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}> = ({ currentColor, onSelectColor, onClose }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tempColor, setTempColor] = useState(currentColor || '#ffffff');
  const [hsv, setHsv] = useState(() => hexToHsv(currentColor || '#ffffff'));
  const satValBoxRef = useRef<HTMLDivElement>(null);
  const hueBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempColor(currentColor || '#ffffff');
    setHsv(hexToHsv(currentColor || '#ffffff'));
  }, [currentColor]);

  const handleSatValMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const updateSatVal = (moveEvt: MouseEvent) => {
      if (!satValBoxRef.current) return;
      const rect = satValBoxRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, moveEvt.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, moveEvt.clientY - rect.top));
      const s = Math.round((x / rect.width) * 100);
      const v = Math.round((1 - y / rect.height) * 100);
      const newHsv = { ...hsv, s, v };
      setHsv(newHsv);
      const hex = hsvToHex(newHsv.h, s, v);
      setTempColor(hex);
    };

    updateSatVal(e.nativeEvent);

    const onMouseMove = (moveEvt: MouseEvent) => updateSatVal(moveEvt);
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleHueMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const updateHue = (moveEvt: MouseEvent) => {
      if (!hueBarRef.current) return;
      const rect = hueBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, moveEvt.clientX - rect.left));
      const h = Math.round((x / rect.width) * 360);
      const newHsv = { ...hsv, h };
      setHsv(newHsv);
      const hex = hsvToHex(h, newHsv.s, newHsv.v);
      setTempColor(hex);
    };

    updateHue(e.nativeEvent);

    const onMouseMove = (moveEvt: MouseEvent) => updateHue(moveEvt);
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleHexChange = (val: string) => {
    setTempColor(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
      setHsv(hexToHsv(val));
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-full mb-2.5 left-0 bg-white rounded-xl shadow-2xl border border-neutral-200 p-3.5 z-[10000] flex text-neutral-800 select-none whitespace-normal"
    >
      {/* 左侧：主题色与常用颜色 (位置绝对固定，完全不位移、不抖动) */}
      <div className="w-48 space-y-3 pr-1 shrink-0">
        <div>
          <div className="text-[12px] text-neutral-600 font-normal mb-2">当前主题颜色</div>
          <div className="flex items-center gap-1.5">
            {MOMO_THEME_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onSelectColor(c);
                  onClose();
                }}
                className="w-5.5 h-5.5 rounded-[2px] border border-neutral-200/90 hover:scale-105 transition-transform cursor-pointer shadow-2xs"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[12px] text-neutral-600 font-normal mb-2">其他常用颜色</div>
          <div className="grid grid-cols-9 gap-1.5">
            {MOMO_COMMON_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  onSelectColor(c);
                  onClose();
                }}
                className="w-4.5 h-4.5 rounded-[2px] border border-neutral-200/80 hover:scale-105 transition-transform cursor-pointer shadow-2xs"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
          <button
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="text-[12px] text-neutral-600 hover:text-neutral-900 font-normal cursor-pointer flex items-center space-x-1"
          >
            <span>更多颜色...</span>
          </button>
        </div>
      </div>

      {/* 右侧：高级拾色器 (点击“更多颜色...”后无缝紧贴右侧展示，左边完全不动，不跳动) */}
      {showAdvanced && (
        <div className="w-56 ml-3 pl-3.5 border-l border-neutral-200 space-y-3 flex flex-col shrink-0">
          {/* 2D 饱和度与明度调色板 */}
          <div
            ref={satValBoxRef}
            onMouseDown={handleSatValMouseDown}
            className="w-full h-36 rounded relative cursor-crosshair overflow-hidden border border-neutral-200"
            style={{
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
              backgroundImage:
                'linear-gradient(to right, #fff, transparent), linear-gradient(to top, #000, transparent)',
            }}
          >
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-[0_0_2px_rgba(0,0,0,0.8)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                backgroundColor: 'transparent',
              }}
            />
          </div>

          {/* 颜色预览圆圈 + 彩虹色相滑条 */}
          <div className="flex items-center space-x-2.5">
            <div
              className="w-6 h-6 rounded-full border border-neutral-200 shrink-0 shadow-2xs"
              style={{ backgroundColor: tempColor }}
            />
            <div
              ref={hueBarRef}
              onMouseDown={handleHueMouseDown}
              className="flex-1 h-3 rounded-full relative cursor-pointer"
              style={{
                background:
                  'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              }}
            >
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.3)] border border-neutral-200 -translate-x-1/2 pointer-events-none"
                style={{ left: `${(hsv.h / 360) * 100}%` }}
              />
            </div>
          </div>

          {/* HEX 色值输入 */}
          <div className="flex flex-col items-center space-y-1">
            <div className="w-full flex items-center justify-between border border-neutral-200 rounded px-2.5 py-1 bg-white">
              <input
                type="text"
                value={tempColor.toUpperCase()}
                onChange={(e) => handleHexChange(e.target.value)}
                className="w-full bg-transparent font-mono text-center outline-none text-neutral-800 text-xs tracking-wider"
              />
              <div className="flex flex-col text-[8px] text-neutral-400 leading-none pl-1">
                <span>▲</span>
                <span>▼</span>
              </div>
            </div>
            <span className="text-[11px] text-neutral-400 font-normal">HEX</span>
          </div>

          {/* 底部 确定 / 取消 操作按钮 */}
          <div className="flex items-center space-x-2 pt-1 border-t border-neutral-100 mt-auto">
            <button
              onClick={() => {
                onSelectColor(tempColor);
                onClose();
              }}
              className="flex-1 py-1.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded text-xs font-normal transition-colors cursor-pointer active:scale-95 text-center"
            >
              确定
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-1.5 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 rounded text-xs font-normal transition-colors cursor-pointer active:scale-95 text-center"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 异形遮罩计算样式 (采用高精度矢量 clipPath 与 objectBoundingBox)
export const getMaskStyle = (maskShape?: string): React.CSSProperties => {
  return getMomoMaskStyle(maskShape);
};

// 导出供外部使用的画框尺寸测量结构
export interface FrameSlotDimensions {
  widthMm: number;
  heightMm: number;
  recommendedPixels: string;
}

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
  onUpdateSlotProps?: (props: Partial<FrameSlot>) => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onMakeFullScreen?: () => void;
  onLocatePhoto?: (photoId: string) => void;
  onUpdateText?: (text: string) => void;
  onUpdateBounds?: (bounds: { x: number; y: number; width: number; height: number; rotation?: number }) => void;
  onCommitBounds?: () => void;
  onDeleteSlot?: () => void;
  onDuplicateSlot?: () => void;
  onStartSwapDrag?: (e: React.MouseEvent) => void;
  isSwapTargetHovered?: boolean;
  onUpdateGuides?: (guides: GuideLine[], spacingGaps?: SpacingGap[]) => void;
  onClearGuides?: () => void;
  onStartMultiDrag?: (e: React.MouseEvent, clickedSlotId: string) => void;
  hasMultipleSelection?: boolean;
  spacingConfig?: SpacingConfig;
  zIndex?: number;
  hairlineThickness?: number;
}

type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// 预设计经典边框颜色
const PRESET_BORDER_COLORS = [
  { name: '纯白', value: '#ffffff' },
  { name: '奶油白', value: '#faf6f0' },
  { name: '曜石黑', value: '#1c1917' },
  { name: '勃艮第红', value: '#76383d' },
  { name: '香槟金', value: '#c5a880' },
  { name: '暖灰', value: '#9ca3af' },
  { name: '复古蓝', value: '#1e3a8a' },
  { name: '松针绿', value: '#14532d' },
];

// 预设异形遮罩
const PRESET_MASKS: { id: MaskShape; name: string; icon: string }[] = [
  { id: 'none', name: '矩形 (原框)', icon: '▢' },
  { id: 'circle', name: '正圆形', icon: '○' },
  { id: 'arch', name: '拱门形', icon: '☖' },
  { id: 'heart', name: '心形', icon: '♥' },
  { id: 'star', name: '五角星', icon: '★' },
  { id: 'diamond', name: '菱形', icon: '◇' },
  { id: 'hexagon', name: '六边形', icon: '⬡' },
  { id: 'pill', name: '胶囊跑道', icon: '⬭' },
  { id: 'stamp', name: '复古邮票', icon: '▦' },
];

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
  onUpdateSlotProps,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onMakeFullScreen,
  onLocatePhoto,
  onUpdateText,
  onUpdateBounds,
  onCommitBounds,
  onDeleteSlot,
  onDuplicateSlot,
  onStartSwapDrag,
  isSwapTargetHovered = false,
  onUpdateGuides,
  onClearGuides,
  onStartMultiDrag,
  zIndex,
  hairlineThickness = 1,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [textVal, setTextVal] = useState(slot.text || '');
  const [activePopover, setActivePopover] = useState<'mask' | 'borderWidth' | 'borderColor' | 'borderRadius' | 'effects' | 'layers' | null>(null);

  // 1. 照片内部裁剪/平移状态 (方案1：按住即平移，松手即完成，无需二次确认)
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

  // 丝滑滚轮缩放状态 (RAF 阻尼插值系统)
  const [activeScale, setActiveScale] = useState<number>(crop.scale || 1.0);
  const currentScaleRef = useRef<number>(crop.scale || 1.0);
  const targetScaleRef = useRef<number>(crop.scale || 1.0);
  const isWheelingRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 当外部 crop.scale 更新且用户当前未在滚动滚轮时，同步本地状态
  useEffect(() => {
    if (!isWheelingRef.current) {
      const s = crop.scale || 1.0;
      currentScaleRef.current = s;
      targetScaleRef.current = s;
      setActiveScale(s);
    }
  }, [crop.scale]);

  // 计算照片是否大于画框（存在裁剪溢出或放大状态，此时显示米莫小手平移按钮）
  const isPhotoOverflowing = useMemo(() => {
    if (!photo) return false;
    if ((activeScale || 1) > 1.02) return true;
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
  }, [photo, slot.width, slot.height, bookSpec, activeScale, crop.rotation]);

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

      // 真实数学几何 1:1 绝对跟手算法：
      // 在 CSS 中，img 设置了 object-fit: cover
      // 1. 计算未放大时 img 的实际渲染包络尺寸 (coverBoxW, coverBoxH)
      const isRotated = (crop.rotation || 0) % 180 !== 0;
      const photoNaturalW = isRotated ? (photo.naturalHeight || 1) : (photo.naturalWidth || 1);
      const photoNaturalH = isRotated ? (photo.naturalWidth || 1) : (photo.naturalHeight || 1);
      const photoAspect = photoNaturalW / photoNaturalH;
      const frameAspect = frameW / Math.max(1, frameH);

      let coverBoxW = frameW;
      let coverBoxH = frameH;
      if (photoAspect > frameAspect) {
        // 照片更宽：高度贴合画框，宽度向两侧溢出
        coverBoxW = frameH * photoAspect;
      } else {
        // 照片更高：宽度贴合画框，高度向上下溢出
        coverBoxH = frameW / photoAspect;
      }

      // 2. 计算放大后照片在画框中的真实总可移动物理像素区间 (travelPixelW, travelPixelH)
      // 在 scale 放大与 objectPosition 共同作用下：
      // 总物理可移动像素 = (coverBoxW - frameW) + (scale - 1) * coverBoxW
      // 即 travelPixel = coverBox * (scale - 1) + (coverBox - frame)
      const scale = Math.max(1.0, activeScale || crop.scale || 1.0);
      const travelW = Math.max(1, (coverBoxW * scale) - frameW);
      const travelH = Math.max(1, (coverBoxH * scale) - frameH);

      // 3. 当鼠标在屏幕上移动 dx 像素时，crop.x (0~100) 变化的物理精确比例：
      // 采用轻快手感增益倍率 (1.35x)，让拖拽移动更省力、响应更灵动敏捷
      const SPEED_MULTIPLIER = 1.35;
      const deltaXPercent = (dx / travelW) * 100 * SPEED_MULTIPLIER;
      const deltaYPercent = (dy / travelH) * 100 * SPEED_MULTIPLIER;

      const newX = Math.max(0, Math.min(100, panStartRef.current.cropX - deltaXPercent));
      const newY = Math.max(0, Math.min(100, panStartRef.current.cropY - deltaYPercent));

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

  // 外部 slot 尺寸/坐标变化时自动清空本地临时快照
  useEffect(() => {
    setLocalBounds(null);
  }, [slot.x, slot.y, slot.width, slot.height, slot.rotation]);

  // --- 画框整体在页面内的拖拽移动 (Move + 智能磁吸对齐，且支持多选整体拖拽) ---
  const handleStartMoveFrame = (e: React.MouseEvent) => {
    if (isEditingText) return;
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
    let hasMoved = false;

    const handleFrameMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startClientX;
      const dy = moveEvt.clientY - startClientY;

      // 3px 移动阈值，防止单击误触移动状态
      if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        hasMoved = true;
        setIsMovingFrame(true);
      }

      if (!hasMoved) return;

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
      const isCornerHandle = ['nw', 'ne', 'se', 'sw'].includes(handle);
      // 默认对角线锚点锁定等比例缩放（按住 Shift 时可临时切换为自由缩放；非对角线边缘锚点为自由拉伸）
      const lockAspectRatio = isCornerHandle ? !moveEvt.shiftKey : moveEvt.shiftKey;

      if (lockAspectRatio) {
        // ========== 1. 对角线等比例缩放 (平滑对角投影算法，彻底杜绝抖动) ==========
        const initialPixelW = (initialW / 100) * parentW;
        const initialPixelH = (initialH / 100) * parentH;
        const initialDiagonal = Math.hypot(initialPixelW, initialPixelH) || 1;
        const cosTheta = initialPixelW / initialDiagonal;
        const sinTheta = initialPixelH / initialDiagonal;

        // 将鼠标位移向量 (dx, dy) 投影到对角线方向向量上，平滑连续，无跳跃突变
        let proj = 0;
        if (handle === 'se') {
          proj = dx * cosTheta + dy * sinTheta;
        } else if (handle === 'sw') {
          proj = -dx * cosTheta + dy * sinTheta;
        } else if (handle === 'ne') {
          proj = dx * cosTheta - dy * sinTheta;
        } else if (handle === 'nw') {
          proj = -dx * cosTheta - dy * sinTheta;
        }

        const minPixelW = (minSize / 100) * parentW;
        const minPixelH = (minSize / 100) * parentH;
        const scale = Math.max(
          minPixelW / initialPixelW,
          minPixelH / initialPixelH,
          (initialDiagonal + proj) / initialDiagonal
        );

        let targetPixelW = initialPixelW * scale;
        let targetPixelH = initialPixelH * scale;

        let targetWidthPercent = (targetPixelW / parentW) * 100;
        let targetHeightPercent = (targetPixelH / parentH) * 100;

        // 根据不同角固定对应相反支点 (Pivot)
        if (handle === 'se') {
          // 固定左上角 (initialX, initialY)
          const maxScaleW = (100 - initialX) / (initialW || 1);
          const maxScaleH = (100 - initialY) / (initialH || 1);
          const maxAllowedScale = Math.min(maxScaleW, maxScaleH);
          const finalScale = Math.min(scale, Math.max(1, maxAllowedScale));

          targetWidthPercent = initialW * finalScale;
          targetHeightPercent = initialH * finalScale;

          newX = initialX;
          newY = initialY;
          newWidth = targetWidthPercent;
          newHeight = targetHeightPercent;
        } else if (handle === 'sw') {
          // 固定右上角 (initialX + initialW, initialY)
          const fixedRight = initialX + initialW;
          const maxScaleW = fixedRight / (initialW || 1);
          const maxScaleH = (100 - initialY) / (initialH || 1);
          const maxAllowedScale = Math.min(maxScaleW, maxScaleH);
          const finalScale = Math.min(scale, Math.max(1, maxAllowedScale));

          targetWidthPercent = initialW * finalScale;
          targetHeightPercent = initialH * finalScale;

          newX = fixedRight - targetWidthPercent;
          newY = initialY;
          newWidth = targetWidthPercent;
          newHeight = targetHeightPercent;
        } else if (handle === 'ne') {
          // 固定左下角 (initialX, initialY + initialH)
          const fixedBottom = initialY + initialH;
          const maxScaleW = (100 - initialX) / (initialW || 1);
          const maxScaleH = fixedBottom / (initialH || 1);
          const maxAllowedScale = Math.min(maxScaleW, maxScaleH);
          const finalScale = Math.min(scale, Math.max(1, maxAllowedScale));

          targetWidthPercent = initialW * finalScale;
          targetHeightPercent = initialH * finalScale;

          newX = initialX;
          newY = fixedBottom - targetHeightPercent;
          newWidth = targetWidthPercent;
          newHeight = targetHeightPercent;
        } else if (handle === 'nw') {
          // 固定右下角 (initialX + initialW, initialY + initialH)
          const fixedRight = initialX + initialW;
          const fixedBottom = initialY + initialH;
          const maxScaleW = fixedRight / (initialW || 1);
          const maxScaleH = fixedBottom / (initialH || 1);
          const maxAllowedScale = Math.min(maxScaleW, maxScaleH);
          const finalScale = Math.min(scale, Math.max(1, maxAllowedScale));

          targetWidthPercent = initialW * finalScale;
          targetHeightPercent = initialH * finalScale;

          newX = fixedRight - targetWidthPercent;
          newY = fixedBottom - targetHeightPercent;
          newWidth = targetWidthPercent;
          newHeight = targetHeightPercent;
        }
      } else {
        // ========== 2. 4 条边中点手柄或按住 Shift 时的自由单向拉伸 ==========
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
      }

      // 计算拉伸过程中的边缘吸附（基于屏幕物理像素，支持固定间隙保持）
      let finalX = newX;
      let finalY = newY;
      let finalW = newWidth;
      let finalH = newHeight;

      if (!lockAspectRatio) {
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
        finalX = snapRes.x;
        finalY = snapRes.y;
        finalW = snapRes.width;
        finalH = snapRes.height;
        if (snapRes.guides.length > 0 || snapRes.spacingGaps.length > 0) {
          onUpdateGuides?.(snapRes.guides, snapRes.spacingGaps);
        } else {
          onClearGuides?.();
        }
      } else {
        const snapRes = calculateProportionalResizeSnap(
          slot.id,
          { x: initialX, y: initialY, width: initialW, height: initialH },
          { x: newX, y: newY, width: newWidth, height: newHeight },
          handle as 'nw' | 'ne' | 'se' | 'sw',
          otherSlotsSnapshot,
          parentW,
          parentH,
          fixedGapConfig
        );
        finalX = snapRes.x;
        finalY = snapRes.y;
        finalW = snapRes.width;
        finalH = snapRes.height;
        if (snapRes.guides.length > 0 || snapRes.spacingGaps.length > 0) {
          onUpdateGuides?.(snapRes.guides, snapRes.spacingGaps);
        } else {
          onClearGuides?.();
        }
      }

      currentSnappedX = finalX;
      currentSnappedY = finalY;
      currentSnappedW = finalW;
      currentSnappedH = finalH;

      setLocalBounds({
        x: finalX,
        y: finalY,
        width: finalW,
        height: finalH,
      });

      onUpdateBounds?.({
        x: finalX,
        y: finalY,
        width: finalW,
        height: finalH,
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

  // 4. 自由旋转把手交互 (米莫同款：顶部旋转手柄 + 实时角度气泡 + 中心纵向辅助虚线 + 0°/90°/180° 磁吸)
  const [isRotating, setIsRotating] = useState(false);
  const [rotateTooltipAngle, setRotateTooltipAngle] = useState<number | null>(null);

  const handleStartRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const frameEl = frameRef.current;
    if (!frameEl) return;

    const rect = frameEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const startSlotRotation = slot.rotation || 0;
    // 鼠标相对于中心的初始弧度转角度
    const startMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    let currentAngle = startSlotRotation;
    let hasMoved = false;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    setIsRotating(true);
    setRotateTooltipAngle(startSlotRotation);

    const handleRotateMouseMove = (moveEvt: MouseEvent) => {
      const dist = Math.hypot(moveEvt.clientX - startClientX, moveEvt.clientY - startClientY);
      if (dist > 3) {
        hasMoved = true;
      }

      const currentMouseAngle = Math.atan2(moveEvt.clientY - centerY, moveEvt.clientX - centerX) * (180 / Math.PI);
      const deltaAngle = currentMouseAngle - startMouseAngle;
      let rawAngle = (startSlotRotation + deltaAngle) % 360;

      // 规范化到 [-180, 180] 范围（呈现 -7°, 45°, 90° 等直观角度）
      if (rawAngle > 180) rawAngle -= 360;
      if (rawAngle < -180) rawAngle += 360;

      // 智能磁吸吸附（米莫同款：在 0°, ±90°, ±180° 等关键中心轴附近自动磁吸对齐，吸附阈值 ±4°）
      const snapAngles = [0, 90, 180, -90, -180, 45, 135, -45, -135];
      const snapThreshold = 4.0; // 吸附范围 ±4.0 度

      let finalAngle = rawAngle;
      for (const snap of snapAngles) {
        if (Math.abs(rawAngle - snap) <= snapThreshold) {
          finalAngle = snap;
          break;
        }
      }

      const roundedAngle = Math.round(finalAngle);
      currentAngle = roundedAngle;

      // 仅更新局部状态，提供 60fps 丝滑无抖动的 GPU 硬件加速旋转体验
      setLocalBounds((prev) => ({
        ...(prev || {
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
        }),
        rotation: roundedAngle,
      }));
      setRotateTooltipAngle(roundedAngle);
    };

    const handleRotateMouseUp = () => {
      window.removeEventListener('mousemove', handleRotateMouseMove);
      window.removeEventListener('mouseup', handleRotateMouseUp);

      setIsRotating(false);
      setRotateTooltipAngle(null);

      // 若发生了拖拽旋转，提交最终角度；若仅是点击则不作任何旋转更改 (纯自由旋转)
      if (hasMoved) {
        setLocalBounds((prev) => (prev ? { ...prev, rotation: currentAngle } : null));
        onUpdateBounds?.({
          x: slot.x,
          y: slot.y,
          width: slot.width,
          height: slot.height,
          rotation: currentAngle,
        });
        onCommitBounds?.();
      }
    };

    window.addEventListener('mousemove', handleRotateMouseMove);
    window.addEventListener('mouseup', handleRotateMouseUp);
  };

  // 照片在画框内部顺时针旋转 90°
  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!photo) return;
    const currentRot = crop.rotation || 0;
    const nextRot = (currentRot + 90) % 360;
    onUpdateCrop({
      ...crop,
      rotation: nextRot,
    });
  };

  // 一键满屏点击处理 (清空本地临时 bounds 确保整页展开)
  const handleMakeFullScreenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalBounds(null);
    onMakeFullScreen?.();
  };

  const handleScaleChange = (newScale: number) => {
    const clamped = Math.max(1.0, Math.min(3.0, Number(newScale.toFixed(2))));
    currentScaleRef.current = clamped;
    targetScaleRef.current = clamped;
    setActiveScale(clamped);
    onUpdateCrop({ ...crop, scale: clamped });
  };

  // 点击【适应框】：画框外框与照片双向 100% 贴合，按照照片原始宽高比自动重新计算画框的宽高与居中坐标
  const handleFitFrameToPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!photo) return;

    // 1. 获取照片原始宽高比 (考虑照片内部旋转 90/270 度)
    const rot = (crop.rotation || 0) % 180;
    const rawW = photo.naturalWidth || 800;
    const rawH = photo.naturalHeight || 600;
    const effectivePhotoW = rot === 90 ? rawH : rawW;
    const effectivePhotoH = rot === 90 ? rawW : rawH;
    const photoAspect = effectivePhotoW / effectivePhotoH;

    // 2. 页面物理毫米尺寸转换，保证在画布上保持无畸变的真实比例
    const pageW_mm = bookSpec?.widthMm || 200;
    const pageH_mm = bookSpec?.heightMm || 200;
    const currentW_mm = (currentRenderW * pageW_mm) / 100;
    const currentH_mm = (currentRenderH * pageH_mm) / 100;
    const currentFrameAspect = currentW_mm / currentH_mm;

    let newW_mm = currentW_mm;
    let newH_mm = currentH_mm;

    if (photoAspect > currentFrameAspect) {
      // 照片比画框更宽：以当前宽度为基准，收缩高度贴合照片
      newH_mm = currentW_mm / photoAspect;
    } else {
      // 照片比画框更高：以当前高度为基准，收缩宽度贴合照片
      newW_mm = currentH_mm * photoAspect;
    }

    // 3. 转换回页面百分比尺寸
    let newPercentW = (newW_mm / pageW_mm) * 100;
    let newPercentH = (newH_mm / pageH_mm) * 100;

    // 限制在页面可视范围内
    if (newPercentW > 98) {
      const scaleDown = 98 / newPercentW;
      newPercentW *= scaleDown;
      newPercentH *= scaleDown;
    }
    if (newPercentH > 98) {
      const scaleDown = 98 / newPercentH;
      newPercentW *= scaleDown;
      newPercentH *= scaleDown;
    }

    // 4. 计算新中心点，保持画框原几何中心不变
    const centerX = currentRenderX + currentRenderW / 2;
    const centerY = currentRenderY + currentRenderH / 2;
    let newX = centerX - newPercentW / 2;
    let newY = centerY - newPercentH / 2;

    // 边界保护
    newX = Math.max(0, Math.min(100 - newPercentW, newX));
    newY = Math.max(0, Math.min(100 - newPercentH, newY));

    // 5. 复位内部缩放与裁剪为标准 1.0x 居中，确保 100% 满画框且无白边无裁切
    handleScaleChange(1.0);
    onUpdateCrop({ ...crop, x: 50, y: 50, scale: 1.0 });
    onUpdateSlotProps?.({ fitMode: 'cover' });

    // 6. 提交新的画框外框几何边界
    onUpdateBounds?.({
      x: Number(newX.toFixed(2)),
      y: Number(newY.toFixed(2)),
      width: Number(newPercentW.toFixed(2)),
      height: Number(newPercentH.toFixed(2)),
      rotation: slot.rotation || 0,
    });
    onCommitBounds?.();
  };

  // 双击画框：智能快速居中复位构图 (若已居中则平滑微放大至 1.25x 便于细调)
  const handleDoubleClickPhoto = (e: React.MouseEvent) => {
    if (!photo) return;
    e.stopPropagation();
    if ((crop.scale && crop.scale > 1.05) || crop.x !== 50 || crop.y !== 50) {
      // 快速复位到 1:1 标准居中
      handleScaleChange(1.0);
      onUpdateCrop({ ...crop, x: 50, y: 50, scale: 1.0 });
      onCommitBounds?.();
    } else {
      // 快速微放大至 1.25x
      handleScaleChange(1.25);
      onUpdateCrop({ ...crop, x: 50, y: 50, scale: 1.25 });
      onCommitBounds?.();
    }
  };

  // 4. 鼠标滚轮悬停缩放（当画框被选中且包含照片时，连续指数比例 + RAF 物理阻尼插值系统）
  useEffect(() => {
    const frameEl = frameRef.current;
    if (!frameEl || !photo || !isSelected) return;

    const animateZoom = () => {
      const current = currentScaleRef.current;
      const target = targetScaleRef.current;
      const diff = target - current;

      // 线性阻尼插值 (Lerp / Damping) - 0.22 阻尼系数带来如丝绸般自然的物理惯性平滑过渡
      if (Math.abs(diff) > 0.001) {
        const next = current + diff * 0.22;
        currentScaleRef.current = next;
        setActiveScale(next);
        rafIdRef.current = requestAnimationFrame(animateZoom);
      } else {
        currentScaleRef.current = target;
        setActiveScale(target);
        rafIdRef.current = null;
        isWheelingRef.current = false;

        // 提交最终精确比例到全局状态
        const finalScale = Number(target.toFixed(2));
        onUpdateCrop({
          ...crop,
          scale: Math.max(1.0, Math.min(3.0, finalScale)),
        });
        onCommitBounds?.();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // 阻止浏览器和画布的默认滚动
      e.preventDefault();
      e.stopPropagation();

      isWheelingRef.current = true;

      // 基于 deltaY 的指数连续比例缩放 (Exponential Scaling)
      // 触控板微动与机械鼠标滚轮均能自动平滑适配
      const zoomSensitivity = 0.0018;
      const zoomFactor = Math.exp(-e.deltaY * zoomSensitivity);
      const newTarget = Math.max(1.0, Math.min(3.0, targetScaleRef.current * zoomFactor));
      targetScaleRef.current = newTarget;

      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(animateZoom);
      }

      // 防抖同步数据给外部（DPI 检测、属性栏）
      if (commitTimeoutRef.current) {
        clearTimeout(commitTimeoutRef.current);
      }
      commitTimeoutRef.current = setTimeout(() => {
        const snapVal = Number(targetScaleRef.current.toFixed(2));
        onUpdateCrop({
          ...crop,
          scale: snapVal,
        });
      }, 150);
    };

    // 使用 passive: false 确保能够成功执行 e.preventDefault() 拦截滚轮默认翻页
    frameEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      frameEl.removeEventListener('wheel', handleWheel);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (commitTimeoutRef.current) {
        clearTimeout(commitTimeoutRef.current);
      }
    };
  }, [photo, isSelected, crop, onUpdateCrop, onCommitBounds]);

  // 动态根据页面基准分辨率 (2027 x 2027 px) 计算画框实际印刷像素尺寸
  const currentRenderX = localBounds?.x !== undefined ? localBounds.x : slot.x;
  const currentRenderY = localBounds?.y !== undefined ? localBounds.y : slot.y;
  const currentRenderW = localBounds?.width !== undefined ? localBounds.width : slot.width;
  const currentRenderH = localBounds?.height !== undefined ? localBounds.height : slot.height;
  const currentRotation = localBounds?.rotation !== undefined ? localBounds.rotation : (slot.rotation || 0);

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
    const currentScale = Math.max(1.0, activeScale || 1.0);
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

  // 计算旋转后 Y 方向的扩展高度 (百分比)，用于将底部操作栏精准定位在旋转图形正下方 (米莫同款)
  const rad = (((currentRotation || 0) * Math.PI) / 180);
  const hw = currentRenderW / 2;
  const hh = currentRenderH / 2;
  const yExtent = hw * Math.abs(Math.sin(rad)) + hh * Math.abs(Math.cos(rad));
  const extraYOffset = yExtent - hh; // 旋转带来的额外向下延伸百分比

  // 全局 Portal 浮动条坐标实时计算 (彻底解决被下层文字框或兄弟元素层叠遮挡的问题)
  const [toolbarPos, setToolbarPos] = useState<{ left: number; top: number; placeAbove?: boolean } | null>(null);

  useEffect(() => {
    if (!isSelected || hasMultipleSelection || isRotating) {
      setToolbarPos(null);
      return;
    }

    const updateToolbarPosition = () => {
      if (!frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const viewportHeight = window.innerHeight;
      const centerX = rect.left + rect.width / 2;
      
      // 默认放置在下方；若距离视口底部不足 70px 则智能翻转到上方
      const placeAbove = rect.bottom + 68 > viewportHeight && rect.top > 70;
      const topY = placeAbove ? (rect.top - 8) : (rect.bottom + 8);

      setToolbarPos({
        left: centerX,
        top: topY,
        placeAbove,
      });
    };

    updateToolbarPosition();
    const animId = requestAnimationFrame(updateToolbarPosition);
    window.addEventListener('scroll', updateToolbarPosition, true);
    window.addEventListener('resize', updateToolbarPosition);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('scroll', updateToolbarPosition, true);
      window.removeEventListener('resize', updateToolbarPosition);
    };
  }, [
    isSelected,
    hasMultipleSelection,
    isRotating,
    currentRenderX,
    currentRenderY,
    currentRenderW,
    currentRenderH,
    currentRotation,
  ]);

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
          zIndex: isMovingFrame ? 80 : (slot.zIndex !== undefined ? slot.zIndex : (zIndex !== undefined ? zIndex : 1)),
        }}
        className="absolute pointer-events-none select-none"
      >
        {/* 内层旋转主体 */}
        <div
          style={{
            transform: currentRotation ? `rotate(${currentRotation}deg)` : undefined,
            transformOrigin: 'center center',
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={handleStartMoveFrame}
          onDoubleClick={() => setIsEditingText(true)}
          className={`w-full h-full relative flex items-center justify-center pointer-events-auto ${
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
              {/* 米莫同款：顶部中央圆形旋转把手 (带微细连接线 + 黑色旋转弧线箭头) */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-40">
                <button
                  type="button"
                  onMouseDown={handleStartRotate}
                  className="w-5.5 h-5.5 rounded-full bg-white border border-neutral-200/90 shadow-[0_2px_5px_rgba(0,0,0,0.18)] flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 transition-transform text-neutral-800 hover:text-black"
                  title="拖拽自由旋转 (靠近 0°/90°/180° 自动磁吸对齐)"
                >
                  <RotateCw className="w-2.5 h-2.5 stroke-[2.2]" />
                </button>
                {/* 连接细线 */}
                <div className="w-[1px] h-1.5 bg-neutral-300 pointer-events-none" />
              </div>

              {/* 旋转实时角度气泡提示 (米莫同款：天蓝色徽章标签，如 -7°、90°、0°) */}
              {rotateTooltipAngle !== null && (
                <div className="absolute -top-7 left-[calc(50%+16px)] z-60 bg-[#3c78d8] text-white text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-[3px] shadow-md pointer-events-none whitespace-nowrap leading-none flex items-center select-none animate-fade-in tracking-tight">
                  <span>{rotateTooltipAngle}°</span>
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
        </div>

        {/* 选中时的浮动快捷操作栏 (通过 createPortal 挂载到全局顶层 document.body，彻底解决被下层文字框覆盖的问题) */}
        {isSelected && !isRotating && toolbarPos && typeof document !== 'undefined' && createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              left: `${toolbarPos.left}px`,
              top: `${toolbarPos.top}px`,
              transform: toolbarPos.placeAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
            }}
            className="bg-white/98 text-neutral-700 shadow-2xl border border-[#dadce0] rounded-xl px-3 py-1.5 flex items-center space-x-2 z-[9999] text-xs pointer-events-auto whitespace-nowrap animate-fade-in"
          >
            <button
              onClick={() => setIsEditingText(true)}
              className="px-2.5 py-1.5 hover:bg-[#faf4f5] hover:text-[#76383d] rounded-lg cursor-pointer text-xs font-semibold"
              title="编辑文字"
            >
              编辑
            </button>
            <button
              onClick={onDuplicateSlot}
              className="w-8 h-8 flex items-center justify-center hover:bg-[#faf4f5] hover:text-[#76383d] rounded-lg cursor-pointer text-neutral-600 active:scale-95"
              title="复制此文本框"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onDeleteSlot}
              className="w-8 h-8 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 rounded-lg cursor-pointer text-neutral-600 active:scale-95"
              title="删除此文本框"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>,
          document.body
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
        zIndex: slot.zIndex !== undefined ? slot.zIndex : (zIndex !== undefined ? zIndex : 1),
      }}
      className="absolute pointer-events-none select-none"
    >
      {/* 内层旋转主体 (画框本体 + 8 锚点 + 顶部旋转手柄) */}
      <div
        style={{
          transform: currentRotation ? `rotate(${currentRotation}deg)` : undefined,
          transformOrigin: 'center center',
          opacity: slot.opacity !== undefined ? slot.opacity : 1,
          borderRadius:
            slot.maskShape && slot.maskShape !== 'none'
              ? undefined
              : slot.borderRadius
              ? `${slot.borderRadius}px`
              : undefined,
          boxShadow: [
            slot.borderWidth && slot.borderWidth > 0
              ? `0 0 0 ${getMomoBorderWidthPx(slot.borderWidth)}px ${slot.borderColor || '#ffffff'}`
              : '',
            slot.hasShadow
              ? '0 12px 28px -4px rgba(0, 0, 0, 0.28), 0 4px 10px -2px rgba(0, 0, 0, 0.12)'
              : '',
          ]
            .filter(Boolean)
            .join(', ') || undefined,
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={handleStartMoveFrame}
        onDoubleClick={handleDoubleClickPhoto}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`w-full h-full relative group pointer-events-auto ${
          slot.maskShape && slot.maskShape !== 'none'
            ? 'bg-transparent'
            : photo
            ? 'bg-transparent'
            : 'bg-[#e2e3e5]'
        } ${
          isSwapTargetHovered
            ? 'shadow-md z-40'
            : isMovingFrame
            ? 'cursor-grabbing shadow-lg'
            : isSelected
            ? 'cursor-move'
            : 'cursor-default'
        } ${
          !isSelected && !isMultiSelected && !isSwapTargetHovered && (!slot.maskShape || slot.maskShape === 'none')
            ? 'hover:outline hover:outline-1 hover:outline-neutral-400'
            : ''
        }`}
      >
      {/* 拖拽互换照片目标悬停高亮提示层 (轻巧 1.5px 优雅细框 + 微透薄纱 + 紧凑精致微徽章) */}
      {isSwapTargetHovered && (
        <div className="absolute inset-0 bg-[#76383d]/8 backdrop-blur-[0.5px] z-50 flex items-center justify-center pointer-events-none animate-fade-in border border-[#76383d] shadow-[inset_0_0_0_1px_rgba(118,56,61,0.25)]">
          <div className="bg-[#76383d]/95 text-white px-2.5 py-1 rounded-full shadow-md flex items-center space-x-1 text-[11px] font-normal border border-white/25">
            <ArrowLeftRight className="w-3 h-3 stroke-[2.2]" />
            <span className="leading-none tracking-tight">松开对调照片</span>
          </div>
        </div>
      )}
      {/* 实时动态像素尺寸标注标签 (仅在未填充照片时显示，或在拉伸调整边框尺寸时提示) */}
      {(!photo || !!activeResizeHandle) && (
        <div className="absolute top-1.5 left-1.5 z-10 text-[9px] font-sans text-white/90 select-none pointer-events-none drop-shadow-xs leading-none tracking-tight">
          {displayPixelText}
        </div>
      )}

      {/* 照片渲染或占位图 (应用圆角、外描边适配、遮罩) */}
      <div
        style={{
          borderRadius:
            slot.maskShape && slot.maskShape !== 'none'
              ? undefined
              : slot.borderRadius
              ? `${slot.borderRadius}px`
              : undefined,
          ...getMaskStyle(slot.maskShape),
        }}
        className="w-full h-full relative overflow-hidden"
      >
        {photo ? (
          <div
            className="w-full h-full relative overflow-hidden flex items-center justify-center"
          >
            {(() => {
              const pageW_mm = bookSpec?.widthMm || 200;
              const pageH_mm = bookSpec?.heightMm || 200;
              const frameAspect = Math.max(0.01, (currentRenderW * pageW_mm) / Math.max(0.01, currentRenderH * pageH_mm));
              const isRotated90 = Math.abs((crop.rotation || 0) % 180) === 90;
              return (
                <div
                  className="relative overflow-hidden flex items-center justify-center transition-none"
                  style={{
                    width: isRotated90 ? `${(1 / frameAspect) * 100}%` : '100%',
                    height: isRotated90 ? `${frameAspect * 100}%` : '100%',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%, -50%) rotate(${crop.rotation || 0}deg) scale(${activeScale}) ${slot.flipH ? 'scaleX(-1)' : ''}`,
                  }}
                >
                  <img
                    src={photo.previewUrl || photo.thumbnailUrl || photo.thumbUrl || photo.url}
                    alt={photo.name}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    style={{
                      objectPosition: slot.fitMode === 'contain' ? 'center' : `${crop.x}% ${crop.y}%`,
                      transform:
                        slot.fitMode === 'contain'
                          ? undefined
                          : `translate(${(50 - crop.x) * (activeScale - 1) * 0.5}%, ${(50 - crop.y) * (activeScale - 1) * 0.5}%)`,
                    }}
                    className={`w-full h-full ${
                      slot.fitMode === 'contain' ? 'object-contain' : 'object-cover'
                    } select-none pointer-events-none`}
                  />
                </div>
              );
            })()}

            {/* 居中裁剪/平移微调锚点：默认隐藏，当鼠标移到画面中心区域时精致浮现，按住即平移，松手即完成 */}
            {isPhotoOverflowing && slot.fitMode !== 'contain' && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 group/center-pan flex items-center justify-center pointer-events-auto z-20">
                <div
                  onMouseDown={handleStartPan}
                  onClick={(e) => e.stopPropagation()}
                  className={`transition-all select-none duration-150 ${
                    isPanning
                      ? 'opacity-100 scale-100 pointer-events-auto'
                      : 'opacity-0 group-hover/center-pan:opacity-100 scale-90 group-hover/center-pan:scale-100 pointer-events-none group-hover/center-pan:pointer-events-auto'
                  }`}
                  title="按住直接平移调整照片构图 (松手即保存，滚动滚轮可缩放)"
                >
                  <div
                    className={`w-6.5 h-6.5 rounded-full bg-white/80 backdrop-blur-[2px] text-neutral-800 border border-white/60 shadow-[0_2px_6px_rgba(0,0,0,0.14),0_0_0_1px_rgba(0,0,0,0.06)] flex items-center justify-center transition-all ${
                      isPanning
                        ? 'cursor-grabbing scale-110 ring-2 ring-[#76383d]/50 bg-white/95 shadow-[0_4px_16px_rgba(0,0,0,0.3)] text-[#76383d]'
                        : 'cursor-grab hover:bg-white/95 hover:scale-105 hover:shadow-[0_3px_10px_rgba(0,0,0,0.2)] active:scale-95'
                    }`}
                  >
                    <IconMoveCross className="w-[15px] h-[15px] select-none pointer-events-none text-neutral-700" />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* 现代相册经典上下垂直布局：[ 📷 相机在上 + 拖照片至此添加在下 ] */
          <div
            className={`w-full h-full flex items-center justify-center p-2 pointer-events-none select-none overflow-hidden ${
              slot.maskShape && slot.maskShape !== 'none' ? 'bg-[#e2e3e5]' : ''
            }`}
          >
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
                <path d="M8.2 6.8L9.5 4.8C9.8 4.3 10.4 4 11 4H13C13.6 4 14.2 4.3 14.5 4.8L15.8 6.8H18.8C20 6.8 21 7.8 21 9V17.5C21 18.9 20 20 18.8 20H5.2C4 20 3 18.9 3 17.5V9C3 7.8 4 6.8 5.2 6.8H8.2Z" />
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

          <div
            className="absolute right-full mr-2 bottom-0 w-max max-w-[220px] px-2.5 py-1.5 bg-neutral-900/95 text-white rounded-md shadow-xl text-[11px] leading-snug opacity-0 invisible group-hover/dpi:opacity-100 group-hover/dpi:visible transition-all duration-150 pointer-events-none z-[120] backdrop-blur-md border border-neutral-700/60"
          >
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

      {/* ========== 选中画框时的 8 个调整尺寸手柄 + 顶部旋转手柄 ========== */}
      {isSelected && !hasMultipleSelection && (
        <>
          {/* 选框外边框 (纯白发光细线，四角圆点 + 四边胶囊条 + 顶部旋转手柄) */}
          <div className="absolute inset-0 pointer-events-none border border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.22)] z-30">
            {photo && (
              <div className="absolute top-0 left-0 w-14 h-14 group/corner-zone pointer-events-auto z-40">
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartSwapDrag?.(e);
                  }}
                  className="absolute top-3 left-3 w-6 h-6 rounded-full bg-white/75 backdrop-blur-[2px] text-neutral-800 shadow-[0_2px_6px_rgba(0,0,0,0.14),0_0_0_1px_rgba(0,0,0,0.06)] border border-white/60 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/95 hover:scale-110 active:scale-95 opacity-0 group-hover/corner-zone:opacity-100 transition-all duration-150 group/swap-btn pointer-events-none group-hover/corner-zone:pointer-events-auto"
                  title="按住拖拽至其他相框互换"
                >
                  <IconHorizontalSwapArrows className="w-3.5 h-3.5 pointer-events-none text-neutral-700" />

                  {/* 悬停微型提示气泡：置于图标右侧向内展示，杜绝溢出画框边缘遮挡 */}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 pointer-events-none opacity-0 group-hover/swap-btn:opacity-100 transition-all duration-150 z-50 whitespace-nowrap">
                    <div className="relative bg-neutral-900/90 text-white text-[10px] font-normal px-2 py-0.5 rounded shadow-md border border-neutral-700/50 flex items-center select-none tracking-normal">
                      拖拽互换
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-1.5 h-1.5 bg-neutral-900/90 border-b border-l border-neutral-700/50 rotate-45 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 顶部中央圆形旋转把手 */}
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-40">
              <button
                type="button"
                onMouseDown={handleStartRotate}
                className="w-5.5 h-5.5 rounded-full bg-white border border-neutral-200/90 shadow-[0_2px_5px_rgba(0,0,0,0.18)] flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 active:scale-95 transition-transform text-neutral-500 hover:text-neutral-700"
                title="拖拽自由旋转画框 (靠近 0°/90°/180° 自动磁吸对齐)"
              >
                <RotateCw className="w-3 h-3 stroke-[2]" />
              </button>
              <div className="w-[1px] h-1.5 bg-neutral-300 pointer-events-none" />
            </div>

            {/* 旋转实时角度气泡提示 */}
            {rotateTooltipAngle !== null && (
              <div className="absolute -top-7 left-[calc(50%+16px)] z-60 bg-[#3c78d8] text-white text-[10px] font-sans font-medium px-1.5 py-0.5 rounded-[3px] shadow-md pointer-events-none whitespace-nowrap leading-none flex items-center select-none animate-fade-in tracking-tight">
                <span>{rotateTooltipAngle}°</span>
              </div>
            )}

            {/* 4 个角手柄 */}
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
                  title="拖拽等比例放大或缩小画框 (按住 Shift 可自由拉伸)"
                />
              );
            })}

            {/* 4 条边中点手柄 */}
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
        </>
      )}
      </div>

      {/* ========== 柔和天蓝色毫米微型浮动标签 (通过 createPortal 挂载到全局顶层 document.body，彻底解决被上层其他重叠照片遮挡的问题) ========== */}
      {isSelected && !hasMultipleSelection && (isMovingFrame || activeResizeHandle) && frameRef.current && typeof document !== 'undefined' && createPortal(
        (() => {
          const rect = frameRef.current?.getBoundingClientRect();
          if (!rect) return null;
          if (isMovingFrame) {
            return (
              <div
                style={{
                  position: 'fixed',
                  left: `${rect.left + rect.width * 0.52}px`,
                  top: `${rect.top + rect.height * 0.5}px`,
                  transform: 'translateY(-50%)',
                }}
                className="z-[99999] bg-[#3c78d8] text-white text-[9.5px] font-sans px-1.5 py-0.5 rounded-[3px] shadow-xs pointer-events-none whitespace-nowrap leading-[13px] flex flex-col items-start select-none animate-fade-in tracking-tight"
              >
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
            );
          }
          if (activeResizeHandle) {
            return (
              <div
                style={{
                  position: 'fixed',
                  left: `${rect.left + 8}px`,
                  top: `${rect.top - 28}px`,
                }}
                className="z-[99999] bg-[#3c78d8] text-white text-[9.5px] font-sans px-1.5 py-0.5 rounded-[3px] shadow-xs pointer-events-none whitespace-nowrap leading-[13px] flex flex-col items-start select-none animate-fade-in tracking-tight"
              >
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
            );
          }
          return null;
        })(),
        document.body
      )}

      {/* ========== 全新设计的照片快速操作浮动条 (Photo Quick Action Bar 紧凑版，通过 createPortal 挂载到全局顶层 document.body，彻底解决被文字框或兄弟图层遮挡的问题) ========== */}
      {isSelected && !hasMultipleSelection && !isRotating && toolbarPos && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: `${toolbarPos.left}px`,
            top: `${toolbarPos.top}px`,
            transform: toolbarPos.placeAbove ? 'translate(-50%, -100%)' : 'translateX(-50%)',
          }}
          className="bg-white/98 text-neutral-700 shadow-2xl border border-[#dadce0] rounded-2xl px-2 py-1.5 flex items-center gap-1 z-[9999] backdrop-blur-md whitespace-nowrap text-sm animate-fade-in pointer-events-auto"
        >
          {/* 【第 1 组：构图与方向】 */}
          {photo && (
            <>
              {/* 1. 缩小与放大按钮组 */}
              <div className="flex items-center gap-0.5 bg-neutral-100/90 rounded-lg p-0.5 border border-neutral-200/80">
                <button
                  onClick={() => handleScaleChange(crop.scale - 0.1)}
                  className="w-7.5 h-7.5 flex items-center justify-center hover:bg-white hover:text-[#76383d] text-neutral-700 rounded-md cursor-pointer transition-colors active:scale-95"
                  title="缩小"
                >
                  <ZoomOut className="w-4.5 h-4.5 stroke-[2]" />
                </button>
                <button
                  onClick={() => handleScaleChange(crop.scale + 0.1)}
                  className="w-7.5 h-7.5 flex items-center justify-center hover:bg-white hover:text-[#76383d] text-neutral-700 rounded-md cursor-pointer transition-colors active:scale-95"
                  title="放大"
                >
                  <ZoomIn className="w-4.5 h-4.5 stroke-[2]" />
                </button>
              </div>

              {/* 2. 图片适应照片框功能 */}
              <button
                onClick={handleFitFrameToPhoto}
                className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-700 active:scale-95"
                title="图片框适应"
              >
                <IconFitFrame className="w-5 h-5" />
              </button>

              {/* 3. 照片框内顺时针旋转 90° */}
              <button
                onClick={handleRotate}
                className="w-8 h-8 flex items-center justify-center hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-700 rounded-lg cursor-pointer transition-colors active:scale-95"
                title="旋转"
              >
                <RotateCw className="w-4.5 h-4.5 stroke-[2]" />
              </button>

              {/* 4. 水平镜像翻转 */}
              <button
                onClick={() => onUpdateSlotProps?.({ flipH: !slot.flipH })}
                className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors active:scale-95 ${
                  slot.flipH
                    ? 'bg-[#faf4f5] text-[#76383d] ring-1.5 ring-[#76383d]'
                    : 'hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-700'
                }`}
                title="水平翻转"
              >
                <IconFlipHorizontalMomo className="w-5 h-5" />
              </button>

              {/* 分割线 */}
              <div className="w-[1px] h-4 bg-neutral-200 shrink-0 mx-0.5" />
            </>
          )}

          {/* 【第 2 组：满屏与构图】 */}
          {/* 5. 照片在整个页面满屏功能 */}
          <button
            onClick={handleMakeFullScreenClick}
            className="w-8 h-8 flex items-center justify-center hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-700 rounded-lg cursor-pointer transition-colors active:scale-95"
            title="满屏"
          >
            <IconFullScreenMomo className="w-5 h-5" />
          </button>

          {/* 分割线 */}
          <div className="w-[1px] h-4 bg-neutral-200 shrink-0 mx-0.5" />

          {/* 【第 3 组：遮罩与样式装饰】 */}
          {/* 7. 遮罩功能 (米莫 40+ 精品异形照片框) */}
          <div className="relative">
            <button
              onClick={() => setActivePopover((prev) => (prev === 'mask' ? null : 'mask'))}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                activePopover === 'mask' || (slot.maskShape && slot.maskShape !== 'none')
                  ? 'bg-[#faf4f5] text-[#76383d] font-medium border border-[#ebdbe0]'
                  : 'hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-700'
              }`}
              title="遮罩"
            >
              <IconMaskMomo className="w-5 h-5" />
            </button>

            {/* 遮罩气泡弹窗 (4列网格，选定即生效并自动收起) */}
            {activePopover === 'mask' && (
              <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-neutral-200 p-2.5 z-[10000] w-64 animate-fade-in text-neutral-800">
                <div className="flex items-center justify-between pb-1.5 border-b border-neutral-100 mb-2 px-1">
                  <span className="font-medium text-xs text-neutral-800">遮罩形状</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 max-h-64 overflow-y-auto pr-1">
                  {MOMO_MASK_DEFINITIONS.map((m) => {
                    const isCurrent = (slot.maskShape || 'none') === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          onUpdateSlotProps?.({ maskShape: m.id });
                          setActivePopover(null);
                        }}
                        title={m.name}
                        className={`aspect-square rounded-md border flex items-center justify-center p-1.5 transition-all cursor-pointer bg-white ${
                          isCurrent
                            ? 'border-[#76383d] ring-1.5 ring-[#76383d] shadow-2xs'
                            : 'border-[#e2e4e8] hover:border-neutral-400 hover:bg-neutral-50/80'
                        }`}
                      >
                        {m.isNone ? (
                          <div className="w-full h-full border border-dashed border-neutral-300 rounded-[2px] bg-neutral-50/50 flex items-center justify-center">
                            <span className="text-[9px] text-neutral-400 font-medium scale-90">原图</span>
                          </div>
                        ) : (
                          <svg viewBox="0 0 100 100" className="w-full h-full fill-[#a3a3a3] pointer-events-none">
                            <path d={m.pathD} />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 8. 边框宽度 (米莫点数下拉菜单) */}
          <div className="relative">
            <button
              onClick={() => setActivePopover((prev) => (prev === 'borderWidth' ? null : 'borderWidth'))}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                activePopover === 'borderWidth' || (slot.borderWidth && slot.borderWidth > 0)
                  ? 'bg-[#faf4f5] text-[#76383d] font-medium border border-[#ebdbe0]'
                  : 'hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-700'
              }`}
              title="边框描边"
            >
              <IconBorderWidthMomo className="w-5 h-5" />
            </button>

            {/* 边框点数下拉菜单 */}
            {activePopover === 'borderWidth' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-neutral-200 py-1.5 z-[10000] w-20 max-h-56 overflow-y-auto animate-fade-in text-neutral-800 text-xs select-none">
                {BORDER_WIDTH_OPTIONS.map((pt) => {
                  const isSelected = (slot.borderWidth || 0) === pt;
                  return (
                    <button
                      key={pt}
                      onClick={() => {
                        onUpdateSlotProps?.({
                          borderWidth: pt,
                          borderColor: slot.borderColor || '#ffffff',
                        });
                        setActivePopover(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-[#faf4f5] hover:text-[#76383d] transition-colors cursor-pointer flex items-center justify-between text-xs ${
                        isSelected ? 'bg-[#faf4f5] text-[#76383d] font-bold' : 'text-neutral-700'
                      }`}
                    >
                      <span>{pt}点</span>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#76383d]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 9. 边框颜色 (米莫水滴颜色气泡选择器) */}
          <div className="relative">
            <button
              onClick={() => setActivePopover((prev) => (prev === 'borderColor' ? null : 'borderColor'))}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                activePopover === 'borderColor' || (slot.borderWidth && slot.borderWidth > 0 && slot.borderColor)
                  ? 'bg-[#faf4f5] text-[#76383d] font-medium border border-[#ebdbe0]'
                  : 'hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-700'
              }`}
              title="边框颜色"
            >
              <IconBorderColorMomo className="w-5 h-5" />
            </button>

            {/* 颜色气泡弹窗 */}
            {activePopover === 'borderColor' && (
              <MomoColorPickerPopover
                currentColor={slot.borderColor || '#ffffff'}
                onSelectColor={(color) => {
                  onUpdateSlotProps?.({
                    borderColor: color,
                    borderWidth: slot.borderWidth && slot.borderWidth > 0 ? slot.borderWidth : 2,
                  });
                }}
                onClose={() => setActivePopover(null)}
              />
            )}
          </div>

          {/* 10. 边框圆角 (米莫圆角数值下拉菜单) */}
          <div className="relative">
            <button
              onClick={() => setActivePopover((prev) => (prev === 'borderRadius' ? null : 'borderRadius'))}
              className={`w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                activePopover === 'borderRadius' || (slot.borderRadius && slot.borderRadius > 0)
                  ? 'bg-[#faf4f5] text-[#76383d] font-medium border border-[#ebdbe0]'
                  : 'hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-700'
              }`}
              title="边框圆角"
            >
              <IconBorderRadiusMomo className="w-5 h-5" />
            </button>

            {/* 圆角数值下拉菜单 */}
            {activePopover === 'borderRadius' && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-neutral-200 py-1.5 z-[10000] w-18 max-h-56 overflow-y-auto animate-fade-in text-neutral-800 text-xs select-none">
                {BORDER_RADIUS_OPTIONS.map((val) => {
                  const isSelected = (slot.borderRadius || 0) === val;
                  return (
                    <button
                      key={val}
                      onClick={() => {
                        onUpdateSlotProps?.({ borderRadius: val });
                        setActivePopover(null);
                      }}
                      className={`w-full text-left px-3 py-1.5 hover:bg-[#faf4f5] hover:text-[#76383d] transition-colors cursor-pointer flex items-center justify-between text-xs ${
                        isSelected ? 'bg-[#faf4f5] text-[#76383d] font-bold' : 'text-neutral-700'
                      }`}
                    >
                      <span>{val}</span>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#76383d]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 分割线 */}
          <div className="w-[1px] h-4 bg-neutral-200 shrink-0 mx-0.5" />

          {/* 【第 4 组：管理与资产】 */}
          {/* 查找照片功能 */}
          {photo && (
            <button
              onClick={() => onLocatePhoto?.(photo.id)}
              className="w-8 h-8 flex items-center justify-center hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-700 rounded-lg cursor-pointer transition-colors"
              title="查找照片"
            >
              <Search className="w-4.5 h-4.5 stroke-[2]" />
            </button>
          )}

          {/* 框内删除照片功能 (清除照片保留画框) */}
          {photo && (
            <button
              onClick={onClearPhoto}
              className="w-8 h-8 flex items-center justify-center hover:bg-rose-50 text-neutral-500 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
              title="移除图片"
            >
              <Trash2 className="w-4.5 h-4.5 stroke-[2]" />
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
