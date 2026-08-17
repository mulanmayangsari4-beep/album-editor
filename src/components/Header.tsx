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
  ShoppingCart,
  Maximize2,
  Grid,
  Check,
  Edit2,
  ChevronDown,
} from 'lucide-react';
import { BookSpec, EditorViewConfig, SpacingConfig } from '../types/editor';

interface HeaderProps {
  bookSpec: BookSpec;
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
  onAddImageSlot: () => void;
  onAddTextSlot: () => void;
  totalPageCount: number;
  hasSelectedSlots?: boolean;
  onLayerOrder?: (action: 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack') => void;
  onAutoFit?: () => void;
}

// 1:1 米莫印品 图层排序矢量图标
const IconBringForward: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
    <rect
      x="5.5"
      y="5.5"
      width="8"
      height="8"
      rx="1"
      stroke={disabled ? '#d1d5db' : '#9ca3af'}
      strokeWidth="1.2"
      fill="none"
    />
    <rect
      x="2.5"
      y="2.5"
      width="8"
      height="8"
      rx="1"
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
      rx="1"
      stroke={disabled ? '#d1d5db' : '#9ca3af'}
      strokeWidth="1.2"
      fill="white"
    />
    <rect
      x="5.5"
      y="5.5"
      width="8"
      height="8"
      rx="1"
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
      rx="0.8"
      stroke={disabled ? '#e5e7eb' : '#d1d5db'}
      strokeWidth="1"
      fill="none"
    />
    <rect
      x="4.5"
      y="4.5"
      width="7"
      height="7"
      rx="0.8"
      stroke={disabled ? '#d1d5db' : '#9ca3af'}
      strokeWidth="1"
      fill="white"
    />
    <rect
      x="2.5"
      y="2.5"
      width="7"
      height="7"
      rx="0.8"
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
      rx="0.8"
      stroke={disabled ? '#9ca3af' : '#333333'}
      strokeWidth="1.3"
      fill="none"
    />
    <rect
      x="4.5"
      y="4.5"
      width="7"
      height="7"
      rx="0.8"
      stroke={disabled ? '#d1d5db' : '#9ca3af'}
      strokeWidth="1"
      fill="white"
    />
    <rect
      x="2.5"
      y="2.5"
      width="7"
      height="7"
      rx="0.8"
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
  onAddImageSlot,
  onAddTextSlot,
  totalPageCount,
  hasSelectedSlots = false,
  onLayerOrder,
  onAutoFit,
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
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleAddToCart = () => {
    setCartSuccess(true);
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
            <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-[#dadce0] rounded-md shadow-lg py-1 z-50 text-xs">
              <div className="px-3 py-1.5 font-semibold text-neutral-500 border-b border-neutral-100">
                可切换相册规格
              </div>
              <button
                onClick={() => setShowSpecDropdown(false)}
                className="w-full text-left px-3 py-2 hover:bg-[#faf4f5] flex items-center justify-between font-medium text-neutral-800"
              >
                <span>完美好翻书-方8 (20x20cm)</span>
                <Check className="w-3.5 h-3.5 text-[#76383d]" />
              </button>
              <button
                onClick={() => setShowSpecDropdown(false)}
                className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center justify-between text-neutral-600"
              >
                <span>拾光精装册-方10 (25x25cm)</span>
              </button>
              <button
                onClick={() => setShowSpecDropdown(false)}
                className="w-full text-left px-3 py-2 hover:bg-neutral-50 flex items-center justify-between text-neutral-600"
              >
                <span>全景硬壳画册-A4横版 (28x21cm)</span>
              </button>
            </div>
          )}
        </div>

        {/* 页数徽标 */}
        <div className="text-xs bg-[#f1f3f4] text-[#5f6368] px-2 py-0.5 rounded border border-[#dadce0] font-mono">
          页数: {totalPageCount}P
        </div>
      </div>

      {/* 中间快捷设计工具条 */}
      <div className="hidden lg:flex items-center space-x-1 border-x border-[#e0e2e6] px-3">
        {/* 撤销 / 重做 */}
        <button
          id="btn-header-undo"
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
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
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
            canRedo ? 'hover:bg-neutral-100 text-[#3c4043] cursor-pointer' : 'text-neutral-300 cursor-not-allowed'
          }`}
          title="重做 (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
          <span>重做</span>
        </button>

        <div className="w-[1px] h-4 bg-[#dadce0] mx-1" />

        {/* 插入图片框 */}
        <button
          id="btn-add-image-frame"
          onClick={onAddImageSlot}
          className="flex items-center space-x-1 px-2 py-1 rounded text-xs hover:bg-neutral-100 text-[#3c4043] transition-colors cursor-pointer"
          title="在当前页面插入新图片框"
        >
          <ImageIcon className="w-3.5 h-3.5 text-neutral-600" />
          <span>图片框</span>
        </button>

        {/* 插入文本框 */}
        <button
          id="btn-add-text-frame"
          onClick={onAddTextSlot}
          className="flex items-center space-x-1 px-2 py-1 rounded text-xs hover:bg-neutral-100 text-[#3c4043] transition-colors cursor-pointer"
          title="在当前页面插入新文字框"
        >
          <Type className="w-3.5 h-3.5 text-neutral-600" />
          <span>文本框</span>
        </button>

        <div className="w-[1px] h-4 bg-[#dadce0] mx-1" />

        {/* 排序 (1:1 还原米莫印品：点击弹出带尖角气泡菜单) */}
        <div className="relative" ref={orderMenuRef}>
          <button
            id="btn-header-layer-order"
            onClick={() => setShowOrderDropdown(!showOrderDropdown)}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
              showOrderDropdown
                ? 'bg-[#faf4f5] text-[#76383d] font-medium'
                : 'hover:bg-neutral-100 text-[#3c4043]'
            }`}
            title="图层层级排序"
          >
            <Layers className={`w-3.5 h-3.5 ${showOrderDropdown ? 'text-[#76383d]' : 'text-neutral-600'}`} />
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

        <div className="w-[1px] h-4 bg-[#dadce0] mx-1" />

        {/* 顶部照片固定间距控制组件 (毫米 mm 选项与勾选状态开关) */}
        <div
          id="toolbar-fixed-spacing-control"
          className={`flex items-center space-x-2 px-2 py-1 rounded border transition-all text-xs select-none ${
            spacingConfig.enabled
              ? 'bg-[#faf4f5] border-[#d8b9be]/70 text-[#76383d]'
              : 'bg-[#f8f9fa] border-[#dadce0] text-neutral-500'
          }`}
        >
          {/* 勾选框：开启/关闭固定间距对齐 */}
          <label className="flex items-center space-x-1.5 cursor-pointer" title="勾选开启照片间距固定对齐，移动与缩放照片时自动保持设定间距；取消勾选可自由移动">
            <input
              type="checkbox"
              id="chk-fixed-spacing-enable"
              checked={spacingConfig.enabled}
              onChange={(e) => onUpdateSpacingConfig?.({ enabled: e.target.checked })}
              className="w-3.5 h-3.5 rounded accent-[#76383d] cursor-pointer"
            />
            <span className="font-medium text-xs">
              固定间距
            </span>
          </label>

          {/* 毫米输入框与单位 */}
          <div className="flex items-center space-x-1 pl-1 border-l border-neutral-300/80">
            <input
              type="number"
              id="input-fixed-spacing-mm"
              min={0}
              max={50}
              step={0.5}
              value={spacingConfig.gapMm}
              disabled={!spacingConfig.enabled}
              onChange={(e) => {
                const val = Math.max(0, Math.min(50, parseFloat(e.target.value) || 0));
                onUpdateSpacingConfig?.({ gapMm: val });
              }}
              className={`w-12 px-1 py-0.5 text-center text-xs font-mono rounded border outline-none transition-colors ${
                spacingConfig.enabled
                  ? 'bg-white border-[#d8b9be] text-[#76383d] font-semibold focus:ring-1 focus:ring-[#76383d]'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed'
              }`}
              title="设置照片之间的固定间隙大小 (单位：毫米 mm)"
            />
            <span className="text-[11px] font-sans text-neutral-500">
              mm
            </span>
          </div>

          {/* 常用预设快捷按钮 (0, 2, 3, 5mm) */}
          {spacingConfig.enabled && (
            <div className="flex items-center space-x-0.5 pl-0.5">
              {[0, 2, 3, 5].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onUpdateSpacingConfig?.({ gapMm: preset })}
                  className={`px-1 py-0.5 text-[10px] rounded leading-none transition-colors cursor-pointer ${
                    spacingConfig.gapMm === preset
                      ? 'bg-[#76383d] text-white font-medium'
                      : 'hover:bg-white text-neutral-600'
                  }`}
                  title={`快速设置为 ${preset}mm 间距`}
                >
                  {preset}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右侧动作区：PSD下载 + 预览 + 保存 + 加入购物车 + 缩放控制 */}
      <div className="flex items-center space-x-2 shrink-0">
        {/* 下载PSD模板 */}
        <button
          id="btn-download-psd-template"
          onClick={handleDownloadPsd}
          className="hidden md:flex items-center space-x-1 px-2.5 py-1 text-xs text-[#3c4043] hover:text-[#76383d] hover:bg-[#faf4f5] border border-[#dadce0] hover:border-[#d8b9be] rounded transition-colors cursor-pointer"
          title="下载标准印刷 PSD/JSON 分辨率规范"
        >
          <FileCode className="w-3.5 h-3.5 text-neutral-500" />
          <span>下载PSD模板</span>
        </button>

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

        {/* 加入购物车 (酒红主按钮，与参考图完全一致) */}
        <button
          id="btn-add-to-cart"
          onClick={handleAddToCart}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#76383d] hover:bg-[#632c30] active:bg-[#522125] text-white rounded text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <ShoppingCart className="w-3.5 h-3.5 text-white" />
          <span>{cartSuccess ? '已加入购物车！' : '加入购物车'}</span>
        </button>

        <div className="w-[1px] h-4 bg-[#dadce0] mx-1" />

        {/* 视图控制：网格、缩放滑块 */}
        <div className="flex items-center space-x-1.5 text-neutral-500">
          <button
            onClick={() => onUpdateViewConfig({ showGrid: !viewConfig.showGrid })}
            className={`p-1 rounded hover:bg-neutral-100 transition-colors cursor-pointer ${
              viewConfig.showGrid ? 'text-[#76383d] bg-[#faf4f5] border border-[#d8b9be]' : 'text-neutral-500'
            }`}
            title={viewConfig.showGrid ? '隐藏网格' : '显示参考网格'}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          {/* 缩放控制滑块 */}
          <div className="flex items-center space-x-1">
            <input
              type="range"
              min="50"
              max="150"
              step="5"
              value={viewConfig.zoomPercent}
              onChange={(e) => onUpdateViewConfig({ zoomPercent: Number(e.target.value) })}
              className="w-16 h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#76383d]"
              title={`缩放比例: ${viewConfig.zoomPercent}%`}
            />
            <span className="text-[10px] font-mono text-neutral-400 w-7 text-right">
              {viewConfig.zoomPercent}%
            </span>
          </div>

          {/* 自动适应屏幕尺寸按钮 */}
          {onAutoFit && (
            <button
              onClick={onAutoFit}
              className="p-1 rounded hover:bg-neutral-100 text-neutral-500 hover:text-[#76383d] transition-colors cursor-pointer flex items-center"
              title="自动适应当前屏幕大小 (自适应比例)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onUpdateViewConfig({ zoomPercent: 100 })}
            className={`px-1 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
              viewConfig.zoomPercent === 100
                ? 'bg-neutral-200 text-neutral-800 font-semibold'
                : 'text-neutral-500 hover:bg-neutral-100 hover:text-[#76383d]'
            }`}
            title="还原为原始 100% 比例"
          >
            1:1
          </button>
        </div>
      </div>
    </header>
  );
};
