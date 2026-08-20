import React, { useState, useEffect, useRef } from 'react';
import {
  Undo2,
  Redo2,
  Image as ImageIcon,
  Type,
  Layers,
  AlignLeft,
  SlidersHorizontal,
  FileCode,
  Eye,
  Save,
  Check,
  Edit2,
  ChevronDown,
  ChevronUp,
  Printer,
} from 'lucide-react';
import { BookSpec, ProductSpec, EditorViewConfig, SpacingConfig } from '../types/editor';
import { PRODUCT_SPECS } from '../data/productSpecs';
import { IconMultiPageGrid } from './MultiPageEditorModal';

interface HeaderProps {
  bookSpec: BookSpec;
  onSelectSpec?: (spec: ProductSpec) => void;
  projectName: string;
  onUpdateProjectName: (name: string) => void;
  viewConfig: EditorViewConfig;
  onUpdateViewConfig: (config: Partial<EditorViewConfig>) => void;
  spacingConfig?: SpacingConfig;
  onUpdateSpacingConfig?: (config: Partial<SpacingConfig>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenPreview: () => void;
  onOpenPrintExport?: () => void;
  onOpenMultiPage?: () => void;
  onAddImageSlot: () => void;
  onAddTextSlot: () => void;
  totalPageCount: number;
  hasSelectedSlots?: boolean;
  onLayerOrder?: (action: 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack') => void;
  onAutoFit?: () => void;
  onSaveProject?: () => void;
  onAddToCart?: () => void;
}

// 1:1 米莫印品 排序顶部主图标 (两个重叠圆角方块：左上后方、右下前方实白)
const IconOrderMomo: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 16 16" fill="none">
    <rect
      x="1.75"
      y="1.75"
      width="9"
      height="9"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.3"
      fill="none"
    />
    <rect
      x="5.25"
      y="5.25"
      width="9"
      height="9"
      rx="1.5"
      stroke="currentColor"
      strokeWidth="1.3"
      fill="white"
    />
  </svg>
);

// 1:1 米莫印品 图层排序矢量图标
const IconBringForward: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
    <rect
      x="5.5"
      y="5.5"
      width="8"
      height="8"
      rx="1.2"
      stroke={disabled ? '#d1d5db' : '#9ca3af'}
      strokeWidth="1.2"
      fill="none"
    />
    <rect
      x="2.5"
      y="2.5"
      width="8"
      height="8"
      rx="1.2"
      stroke={disabled ? '#9ca3af' : '#333333'}
      strokeWidth="1.3"
      fill="white"
    />
  </svg>
);

const IconSendBackward: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
    <rect
      x="2.5"
      y="2.5"
      width="8"
      height="8"
      rx="1.2"
      stroke={disabled ? '#d1d5db' : '#9ca3af'}
      strokeWidth="1.2"
      fill="white"
    />
    <rect
      x="5.5"
      y="5.5"
      width="8"
      height="8"
      rx="1.2"
      stroke={disabled ? '#9ca3af' : '#333333'}
      strokeWidth="1.3"
      fill="none"
    />
  </svg>
);

const IconBringToFront: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
    <rect
      x="6.5"
      y="6.5"
      width="7"
      height="7"
      rx="1"
      stroke={disabled ? '#e5e7eb' : '#d1d5db'}
      strokeWidth="1"
      fill="none"
    />
    <rect
      x="4.5"
      y="4.5"
      width="7"
      height="7"
      rx="1"
      stroke={disabled ? '#d1d5db' : '#9ca3af'}
      strokeWidth="1"
      fill="white"
    />
    <rect
      x="2.5"
      y="2.5"
      width="7"
      height="7"
      rx="1"
      stroke={disabled ? '#9ca3af' : '#333333'}
      strokeWidth="1.3"
      fill="white"
    />
  </svg>
);

const IconSendToBack: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
    <rect
      x="6.5"
      y="6.5"
      width="7"
      height="7"
      rx="1"
      stroke={disabled ? '#9ca3af' : '#333333'}
      strokeWidth="1.3"
      fill="none"
    />
    <rect
      x="4.5"
      y="4.5"
      width="7"
      height="7"
      rx="1"
      stroke={disabled ? '#d1d5db' : '#9ca3af'}
      strokeWidth="1"
      fill="white"
    />
    <rect
      x="2.5"
      y="2.5"
      width="7"
      height="7"
      rx="1"
      stroke={disabled ? '#e5e7eb' : '#d1d5db'}
      strokeWidth="1"
      fill="white"
    />
  </svg>
);

export const Header: React.FC<HeaderProps> = ({
  bookSpec,
  projectName,
  onUpdateProjectName,
  viewConfig,
  onUpdateViewConfig,
  spacingConfig = { enabled: true, gapMm: 2 },
  onUpdateSpacingConfig,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenPreview,
  onOpenPrintExport,
  onOpenMultiPage,
  onAddImageSlot,
  onAddTextSlot,
  totalPageCount,
  hasSelectedSlots = false,
  onLayerOrder,
  onAutoFit,
  onSaveProject,
  onAddToCart,
  onSelectSpec,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectName);
  const [isSaved, setIsSaved] = useState(false);
  const [showSpecDropdown, setShowSpecDropdown] = useState(false);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);

  const orderMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部自动收起下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orderMenuRef.current && !orderMenuRef.current.contains(e.target as Node)) {
        setShowOrderDropdown(false);
      }
    };
    if (showOrderDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOrderDropdown]);

  const handleTitleSubmit = () => {
    if (titleInput.trim()) {
      onUpdateProjectName(titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const handleSave = () => {
    setIsSaved(true);
    onSaveProject?.();
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddToCart = () => {
    setCartSuccess(true);
    onAddToCart?.();
    setTimeout(() => setCartSuccess(false), 2500);
  };

  const handleDownloadPsd = () => {
    const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify({ project: projectName, spec: bookSpec, pages: totalPageCount }, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonStr);
    downloadAnchor.setAttribute('download', `${projectName}_排版规范模板.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <header
      id="top-editor-header"
      className="h-12 bg-white border-b border-[#e0e2e6] px-3 flex items-center justify-between select-none z-30 shrink-0 text-[#3c4043] shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      {/* 左侧：品牌 Logo + 项目名 + 规格下拉 + 页数 */}
      <div className="flex items-center space-x-3 shrink-0">
        {/* 品牌酒红小标 */}
        <div className="flex items-center space-x-1.5 cursor-pointer">
          <div className="w-6 h-6 rounded bg-[#76383d] flex items-center justify-center text-white font-bold text-xs shadow-xs">
            m
          </div>
        </div>

        {/* 项目名称 (带铅笔编辑) */}
        <div className="flex items-center space-x-1 border-r border-[#e0e2e6] pr-3">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              autoFocus
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              className="px-1.5 py-0.5 text-xs font-medium border border-[#76383d] rounded outline-none text-[#202124]"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center space-x-1 hover:bg-neutral-100 px-1.5 py-1 rounded text-xs text-[#202124] font-medium transition-colors group cursor-pointer"
              title="点击修改作品名称"
            >
              <Edit2 className="w-3 h-3 text-neutral-400 group-hover:text-neutral-700" />
              <span>{projectName}</span>
            </button>
          )}
        </div>

        {/* 规格标签与下拉菜单 */}
        <div className="relative">
          <button
            onClick={() => setShowSpecDropdown(!showSpecDropdown)}
            className="flex items-center space-x-1.5 text-xs text-[#3c4043] hover:text-[#202124] hover:bg-neutral-100 px-2 py-1 rounded transition-colors cursor-pointer"
          >
            <span>{bookSpec.name} {bookSpec.widthMm / 10} x {bookSpec.heightMm / 10}cm</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {showSpecDropdown && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-[#dadce0] rounded-md shadow-lg py-1 z-50 text-xs animate-fade-in">
              <div className="px-3 py-1.5 font-semibold text-neutral-500 border-b border-neutral-100 flex items-center justify-between">
                <span>切换商品与印刷规格</span>
                <span className="text-[10px] text-neutral-400 font-mono">毫米真值</span>
              </div>
              {Object.values(PRODUCT_SPECS).map((spec) => {
                const isSelected = spec.id === bookSpec.id;
                return (
                  <button
                    key={spec.id}
                    onClick={() => {
                      onSelectSpec?.(spec);
                      setShowSpecDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-start justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#faf4f5] text-[#76383d] font-medium'
                        : 'hover:bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-medium">{spec.name}</span>
                        <span className="text-[10px] px-1 bg-neutral-100 text-neutral-500 rounded border border-neutral-200">
                          {spec.categoryName || spec.productType}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                        {spec.widthMm} x {spec.heightMm} mm (出血 {spec.bleedMm}mm)
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#76383d] mt-1 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 页数徽标 */}
        <div className="text-xs bg-[#f1f3f4] text-[#5f6368] px-2 py-0.5 rounded border border-[#dadce0] font-mono">
          页数: {totalPageCount}P
        </div>
      </div>

      {/* 中间快捷设计工具条 (紧凑精致) */}
      <div className="hidden lg:flex items-center space-x-0.5 border-x border-[#e0e2e6] px-1.5">
        {/* 插入图片框 */}
        <button
          id="btn-add-image-frame"
          onClick={onAddImageSlot}
          className="flex items-center space-x-1 px-1.5 py-1 rounded text-xs hover:bg-neutral-100 text-[#3c4043] transition-colors cursor-pointer"
          title="在当前页面插入新图片框"
        >
          <ImageIcon className="w-3.5 h-3.5 text-neutral-600" />
          <span>图片框</span>
        </button>

        {/* 插入文本框 (移动至左侧) */}
        <button
          id="btn-add-text-frame"
          onClick={onAddTextSlot}
          className="flex items-center space-x-1 px-1.5 py-1 rounded text-xs hover:bg-neutral-100 text-[#3c4043] transition-colors cursor-pointer"
          title="在当前页面插入新文字框"
        >
          <Type className="w-3.5 h-3.5 text-neutral-600" />
          <span>文本框</span>
        </button>

        <div className="w-[1px] h-3.5 bg-[#dadce0] mx-0.5" />

        {/* 撤销 / 重做 */}
        <button
          id="btn-header-undo"
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex items-center space-x-1 px-1.5 py-1 rounded text-xs transition-colors ${
            canUndo ? 'hover:bg-neutral-100 text-[#3c4043] cursor-pointer' : 'text-neutral-300 cursor-not-allowed'
          }`}
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>撤销</span>
        </button>
        <button
          id="btn-header-redo"
          onClick={onRedo}
          disabled={!canRedo}
          className={`flex items-center space-x-1 px-1.5 py-1 rounded text-xs transition-colors ${
            canRedo ? 'hover:bg-neutral-100 text-[#3c4043] cursor-pointer' : 'text-neutral-300 cursor-not-allowed'
          }`}
          title="重做 (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
          <span>重做</span>
        </button>

        <div className="w-[1px] h-3.5 bg-[#dadce0] mx-0.5" />

        {/* 排序 (1:1 还原米莫印品：点击弹出带尖角气泡菜单) */}
        <div className="relative" ref={orderMenuRef}>
          <button
            id="btn-header-layer-order"
            onClick={() => setShowOrderDropdown(!showOrderDropdown)}
            className={`flex items-center space-x-1 px-1.5 py-1 rounded text-xs transition-colors cursor-pointer ${
              showOrderDropdown
                ? 'bg-[#faf4f5] text-[#76383d] font-medium'
                : 'hover:bg-neutral-100 text-[#3c4043]'
            }`}
            title="图层层级排序"
          >
            <IconOrderMomo className={`w-3.5 h-3.5 ${showOrderDropdown ? 'text-[#76383d]' : 'text-neutral-700'}`} />
            <span>排序</span>
            <ChevronDown className={`w-3 h-3 ${showOrderDropdown ? 'text-[#76383d] rotate-180' : 'text-neutral-400'} transition-transform`} />
          </button>

          {/* 米莫同款白色气泡浮动菜单 (带向上小三角指针) */}
          {showOrderDropdown && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white border border-neutral-200/90 shadow-xl rounded-md py-1.5 min-w-[118px] flex flex-col animate-fade-in select-none">
              {/* 顶部小三角指向箭头 */}
              <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-t border-l border-neutral-200/90 transform rotate-45" />

              <button
                type="button"
                id="btn-order-bring-forward"
                disabled={!hasSelectedSlots}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onLayerOrder?.('bringForward');
                  setShowOrderDropdown(false);
                }}
                className={`flex items-center space-x-2.5 px-3 py-1.5 text-xs text-left transition-colors relative z-10 ${
                  hasSelectedSlots
                    ? 'hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-800 cursor-pointer'
                    : 'text-neutral-300 cursor-not-allowed'
                }`}
                title={hasSelectedSlots ? '将当前选中画框上移一层' : '请先选中画框'}
              >
                <IconBringForward disabled={!hasSelectedSlots} />
                <span className="font-normal">上移一层</span>
              </button>

              <button
                type="button"
                id="btn-order-send-backward"
                disabled={!hasSelectedSlots}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onLayerOrder?.('sendBackward');
                  setShowOrderDropdown(false);
                }}
                className={`flex items-center space-x-2.5 px-3 py-1.5 text-xs text-left transition-colors relative z-10 ${
                  hasSelectedSlots
                    ? 'hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-800 cursor-pointer'
                    : 'text-neutral-300 cursor-not-allowed'
                }`}
                title={hasSelectedSlots ? '将当前选中画框下移一层' : '请先选中画框'}
              >
                <IconSendBackward disabled={!hasSelectedSlots} />
                <span className="font-normal">下移一层</span>
              </button>

              <button
                type="button"
                id="btn-order-bring-to-front"
                disabled={!hasSelectedSlots}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onLayerOrder?.('bringToFront');
                  setShowOrderDropdown(false);
                }}
                className={`flex items-center space-x-2.5 px-3 py-1.5 text-xs text-left transition-colors relative z-10 ${
                  hasSelectedSlots
                    ? 'hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-800 cursor-pointer'
                    : 'text-neutral-300 cursor-not-allowed'
                }`}
                title={hasSelectedSlots ? '将当前选中画框置于最顶层' : '请先选中画框'}
              >
                <IconBringToFront disabled={!hasSelectedSlots} />
                <span className="font-normal">置于顶部</span>
              </button>

              <button
                type="button"
                id="btn-order-send-to-back"
                disabled={!hasSelectedSlots}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onLayerOrder?.('sendToBack');
                  setShowOrderDropdown(false);
                }}
                className={`flex items-center space-x-2.5 px-3 py-1.5 text-xs text-left transition-colors relative z-10 ${
                  hasSelectedSlots
                    ? 'hover:bg-[#faf4f5] hover:text-[#76383d] text-neutral-800 cursor-pointer'
                    : 'text-neutral-300 cursor-not-allowed'
                }`}
                title={hasSelectedSlots ? '将当前选中画框置于最底层' : '请先选中画框'}
              >
                <IconSendToBack disabled={!hasSelectedSlots} />
                <span className="font-normal">置于底部</span>
              </button>
            </div>
          )}
        </div>

        {/* 对齐 */}
        <button
          className="flex items-center space-x-0.5 px-1.5 py-1 rounded text-xs hover:bg-neutral-100 text-[#3c4043] transition-colors cursor-pointer"
          title="对象对齐"
        >
          <AlignLeft className="w-3.5 h-3.5 text-neutral-600" />
          <span>对齐</span>
          <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
        </button>

        {/* 分布 */}
        <button
          className="flex items-center space-x-0.5 px-1.5 py-1 rounded text-xs hover:bg-neutral-100 text-[#3c4043] transition-colors cursor-pointer"
          title="间距均匀分布"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-600" />
          <span>分布</span>
          <ChevronDown className="w-2.5 h-2.5 text-neutral-400" />
        </button>

        <div className="w-[1px] h-3.5 bg-[#dadce0] mx-0.5" />

        {/* 顶部照片间距控制组件 (支持每点一下多增加/减少 1mm) */}
        <div
          id="toolbar-fixed-spacing-control"
          className={`flex items-center space-x-1.5 px-1.5 py-0.5 rounded border transition-all text-xs select-none ${
            spacingConfig.enabled
              ? 'bg-[#faf4f5] border-[#d8b9be]/70 text-[#76383d]'
              : 'bg-[#f8f9fa] border-[#dadce0] text-neutral-600'
          }`}
        >
          {/* 勾选框：开启/关闭照片间距对齐 */}
          <label className="flex items-center space-x-1 cursor-pointer" title="勾选开启照片间距固定对齐，移动与缩放照片时自动保持设定间距；取消勾选可自由移动">
            <input
              type="checkbox"
              id="chk-fixed-spacing-enable"
              checked={spacingConfig.enabled}
              onChange={(e) => onUpdateSpacingConfig?.({ enabled: e.target.checked })}
              className="w-3.5 h-3.5 rounded accent-[#76383d] cursor-pointer"
            />
            <span className="font-medium text-xs whitespace-nowrap">
              照片间距
            </span>
          </label>

          {/* 毫米输入框与单位 (支持每点一下多增加/减少 1mm) */}
          <div className="flex items-center space-x-1 pl-1.5 border-l border-neutral-300/80">
            <div className="relative flex items-center bg-white rounded border border-[#d8b9be] focus-within:ring-1 focus-within:ring-[#76383d] overflow-hidden">
              <input
                type="number"
                id="input-fixed-spacing-mm"
                min={0}
                max={50}
                step={1}
                value={spacingConfig.gapMm}
                onChange={(e) => {
                  const val = Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0));
                  onUpdateSpacingConfig?.({ gapMm: val, enabled: true });
                }}
                className="w-8 pl-1 pr-3.5 py-0.5 text-center text-xs font-mono bg-transparent text-[#76383d] font-semibold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="照片间距大小 (单位：毫米 mm，点击右侧上下箭头每点一下增加/减少 1mm)"
              />
              <div className="absolute right-0 inset-y-0 w-3.5 flex flex-col border-l border-[#ebdbe0] divide-y divide-[#ebdbe0] bg-neutral-50/80">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = Math.min(50, Math.round((spacingConfig.gapMm || 0) + 1));
                    onUpdateSpacingConfig?.({ gapMm: nextVal, enabled: true });
                  }}
                  className="flex-1 flex items-center justify-center text-neutral-500 hover:text-[#76383d] hover:bg-neutral-100 cursor-pointer"
                  title="增加 1mm"
                >
                  <ChevronUp className="w-2.5 h-2.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = Math.max(0, Math.round((spacingConfig.gapMm || 0) - 1));
                    onUpdateSpacingConfig?.({ gapMm: nextVal, enabled: true });
                  }}
                  className="flex-1 flex items-center justify-center text-neutral-500 hover:text-[#76383d] hover:bg-neutral-100 cursor-pointer"
                  title="减少 1mm"
                >
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            <span className="text-[11px] font-sans text-neutral-500">
              mm
            </span>
          </div>
        </div>
      </div>

      {/* 右侧动作区：预览 + 保存 + 加入购物车 + 缩放控制 */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* 多页编辑与总览 (图邦主模式) */}
        {onOpenMultiPage && (
          <button
            id="btn-header-multi-page-view"
            onClick={onOpenMultiPage}
            className="flex items-center space-x-1.5 px-2.5 py-1 text-xs text-white bg-[#76383d] hover:bg-[#632c30] rounded transition-all cursor-pointer font-medium shadow-2xs"
            title="打开全书多页编辑与总览 (图邦主平铺模式)"
          >
            <IconMultiPageGrid className="w-3.5 h-3.5" />
            <span>多页编辑</span>
          </button>
        )}

        {/* 导出 300DPI 印刷图 (印前质检测试) */}
        {onOpenPrintExport && (
          <button
            id="btn-export-print-300dpi"
            onClick={onOpenPrintExport}
            className="flex items-center space-x-1 px-2.5 py-1 text-xs text-[#76383d] bg-[#faf4f5] hover:bg-[#f3e6e8] border border-[#d8b9be] rounded transition-colors cursor-pointer font-medium"
            title="导出当前页面 300 DPI 印刷级高清 JPG 进行印前质检检测"
          >
            <Printer className="w-3.5 h-3.5 text-[#76383d]" />
            <span>导出印刷图 (300DPI)</span>
          </button>
        )}

        {/* 预览 */}
        <button
          id="btn-open-full-preview"
          onClick={onOpenPreview}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs text-[#3c4043] hover:text-[#76383d] hover:bg-[#faf4f5] hover:border-[#d8b9be] rounded transition-colors cursor-pointer border border-[#dadce0]"
          title="全书翻页预览"
        >
          <Eye className="w-3.5 h-3.5 text-neutral-500" />
          <span>预览</span>
        </button>

        {/* 保存 */}
        <button
          id="btn-save-project"
          onClick={handleSave}
          className="flex items-center space-x-1 px-2.5 py-1 text-xs text-[#3c4043] hover:text-[#76383d] hover:bg-[#faf4f5] hover:border-[#d8b9be] rounded transition-colors cursor-pointer border border-[#dadce0]"
          title="保存当前草稿"
        >
          {isSaved ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-600 font-medium">已保存</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-neutral-500" />
              <span>保存</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
