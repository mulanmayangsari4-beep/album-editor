import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  CheckCircle2,
  Sparkles,
  Layers,
  ZoomIn,
  Loader2,
  FileImage,
  Sliders,
  Check,
} from 'lucide-react';
import { SpreadModel, BookSpec, UploadedPhoto } from '../types/editor';
import {
  exportSpreadToPrintJpg,
  downloadBlob,
  PrintExportResult,
} from '../utils/printExportRenderer';

interface PrintExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpread: SpreadModel;
  bookSpec: BookSpec;
  photos: UploadedPhoto[];
  projectName: string;
}

export const PrintExportModal: React.FC<PrintExportModalProps> = ({
  isOpen,
  onClose,
  currentSpread,
  bookSpec,
  photos,
  projectName,
}) => {
  const [scope, setScope] = useState<'spread' | 'leftPage' | 'rightPage'>('spread');
  const [targetDpi, setTargetDpi] = useState<number>(300);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [exportResult, setExportResult] = useState<PrintExportResult | null>(null);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setExportResult(null);
      setProgressPercent(0);
      setProgressMessage('');
      setIsExporting(false);
    }
  }, [isOpen, currentSpread.id]);

  if (!isOpen) return null;

  // 300 DPI 纯净成品像素尺寸计算 (无裁切线、无多余黑白边)
  const pxPerMm = targetDpi / 25.4;
  const singleW = Math.round(bookSpec.widthMm * pxPerMm);
  const singleH = Math.round(bookSpec.heightMm * pxPerMm);
  const totalW = scope === 'spread' ? singleW * 2 : singleW;
  const totalH = singleH;

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgressPercent(5);
    setProgressMessage('准备中...');
    setExportResult(null);

    try {
      const result = await exportSpreadToPrintJpg({
        spread: currentSpread,
        bookSpec,
        photos,
        projectName,
        scope,
        includeBleed: false,    // 纯净成品印刷图 (无多余外延)
        includeCropMarks: false,// 无裁切线
        targetDpi,
        quality: 0.98,
        onProgress: (percent, msg) => {
          setProgressPercent(percent);
          setProgressMessage(msg);
        },
      });

      setExportResult(result);
    } catch (err) {
      console.error('Export print file failed:', err);
      alert('导出印刷图失败，请检查控制台或重试。');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (exportResult) {
      downloadBlob(exportResult.blob, exportResult.fileName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-[#fafafa]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#76383d]/10 text-[#76383d] flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
                <span>导出 300 DPI 纯净印刷图 (无裁切线)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                  写入 300 DPI 物理元数据
                </span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                1:1 还原排版几何、照片裁切与缩放，Photoshop 打开直接显示 300 像素/英寸
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主体设置与预览区 */}
        <div className="p-6 overflow-y-auto space-y-5 text-neutral-700 text-xs">
          {/* 1. 导出范围与规格 */}
          <div className="space-y-2">
            <label className="font-semibold text-neutral-900 flex items-center justify-between">
              <span>导出范围</span>
              <span className="font-normal text-neutral-500">
                当前跨页：第 {currentSpread.spreadIndex + 1} 跨页（第 {currentSpread.leftPage.pageNumber}-{currentSpread.rightPage.pageNumber} 页）
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setScope('spread')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  scope === 'spread'
                    ? 'border-[#76383d] bg-[#76383d]/5 ring-1 ring-[#76383d]'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="font-medium text-neutral-900 flex items-center justify-between">
                  <span>双页展开跨页</span>
                  {scope === 'spread' && <Check className="w-3.5 h-3.5 text-[#76383d]" />}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  左右完整展板 ({bookSpec.widthMm * 2} × {bookSpec.heightMm}mm)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('leftPage')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  scope === 'leftPage'
                    ? 'border-[#76383d] bg-[#76383d]/5 ring-1 ring-[#76383d]'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="font-medium text-neutral-900 flex items-center justify-between">
                  <span>仅左页 (P{currentSpread.leftPage.pageNumber})</span>
                  {scope === 'leftPage' && <Check className="w-3.5 h-3.5 text-[#76383d]" />}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  单页成品 ({bookSpec.widthMm} × {bookSpec.heightMm}mm)
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('rightPage')}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  scope === 'rightPage'
                    ? 'border-[#76383d] bg-[#76383d]/5 ring-1 ring-[#76383d]'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="font-medium text-neutral-900 flex items-center justify-between">
                  <span>仅右页 (P{currentSpread.rightPage.pageNumber})</span>
                  {scope === 'rightPage' && <Check className="w-3.5 h-3.5 text-[#76383d]" />}
                </div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  单页成品 ({bookSpec.widthMm} × {bookSpec.heightMm}mm)
                </div>
              </button>
            </div>
          </div>

          {/* 2. 印刷分辨率与纯净说明 */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            {/* 分辨率 */}
            <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/80 space-y-2">
              <span className="font-medium text-neutral-900 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-neutral-500" />
                <span>目标分辨率 (EXIF/JFIF Header)</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTargetDpi(300)}
                  className={`flex-1 py-1.5 px-2 rounded text-center font-medium transition-colors cursor-pointer ${
                    targetDpi === 300
                      ? 'bg-[#76383d] text-white'
                      : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  300 DPI (印刷标准)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetDpi(150)}
                  className={`flex-1 py-1.5 px-2 rounded text-center font-medium transition-colors cursor-pointer ${
                    targetDpi === 150
                      ? 'bg-[#76383d] text-white'
                      : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  150 DPI (打样预览)
                </button>
              </div>
            </div>

            {/* 纯净输出说明 */}
            <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/80 space-y-2">
              <span className="font-medium text-neutral-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-neutral-500" />
                <span>纯净成品模式</span>
              </span>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                ✓ <strong>无裁切线</strong>：紧贴版心边缘，零多余边框留白<br />
                ✓ <strong>无占位水印</strong>：未输入文字自动留白，不印刷引导符
              </p>
            </div>
          </div>

          {/* 3. 尺寸估算信息卡片 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50/70 border border-blue-100 text-blue-900">
            <div className="flex items-center space-x-2">
              <FileImage className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-medium">导出的实际像素规格：</span>
                <span className="font-mono font-semibold ml-1.5 text-blue-800">
                  {totalW} × {totalH} 像素
                </span>
                <span className="text-[11px] text-blue-700 ml-2">
                  (真实 300 像素/英寸 · 约 4~8MB 超高保真 JPG)
                </span>
              </div>
            </div>
          </div>

          {/* 4. 进度条或完成后的预览展示 */}
          {isExporting && (
            <div className="p-4 rounded-lg bg-neutral-50 border border-neutral-200 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs text-neutral-600">
                <span className="flex items-center gap-1.5 font-medium text-neutral-800">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#76383d]" />
                  <span>{progressMessage || '正在生成...'}</span>
                </span>
                <span className="font-mono font-semibold text-[#76383d]">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#76383d] h-2 rounded-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {exportResult && (
            <div className="p-4 rounded-lg bg-emerald-50/80 border border-emerald-200 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>300 DPI 纯净印刷文件生成完毕！</span>
                </div>
                <span className="text-xs text-emerald-700 font-mono">
                  {exportResult.widthPx} × {exportResult.heightPx} px · 300 DPI · {(exportResult.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>

              {/* 缩略图预览卡片 */}
              <div className="relative w-full h-40 bg-neutral-900/5 rounded-md overflow-hidden border border-neutral-200/80 flex items-center justify-center group">
                <img
                  src={exportResult.dataUrl}
                  alt="300 DPI Export Preview"
                  className="max-h-full max-w-full object-contain shadow-sm"
                />
                <a
                  href={exportResult.dataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium gap-1.5 cursor-zoom-in"
                  title="在新标签页中 100% 原始像素查看"
                >
                  <ZoomIn className="w-4 h-4" />
                  <span>点击在新标签页中 1:1 放大查看局部细节</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-neutral-100 bg-[#fafafa]">
          <div className="text-[11px] text-neutral-400">
            提示：在 Photoshop「图像大小」中可直接查看到 300 像素/英寸
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/80 rounded transition-colors cursor-pointer"
            >
              关闭
            </button>

            {exportResult ? (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>立即下载 300DPI 纯净 JPG</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isExporting}
                onClick={handleStartExport}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#76383d] hover:bg-[#632c30] disabled:bg-[#76383d]/60 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>正在合成导出...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>开始生成 300 DPI 印刷图</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
