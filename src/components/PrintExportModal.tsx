import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  Printer,
  CheckCircle2,
  Sparkles,
  Loader2,
  FolderArchive,
  FileCheck,
  BookOpen,
} from 'lucide-react';
import JSZip from 'jszip';
import { SpreadModel, BookSpec, UploadedPhoto } from '../types/editor';
import {
  exportSpreadToPrintJpg,
  downloadBlob,
} from '../utils/printExportRenderer';

interface PrintExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreads: SpreadModel[];
  bookSpec: BookSpec;
  photos: UploadedPhoto[];
  projectName: string;
}

export const PrintExportModal: React.FC<PrintExportModalProps> = ({
  isOpen,
  onClose,
  spreads,
  bookSpec,
  photos,
  projectName,
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [currentRenderIndex, setCurrentRenderIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastRenderedThumb, setLastRenderedThumb] = useState<string | null>(null);
  const [completedZipBlob, setCompletedZipBlob] = useState<Blob | null>(null);
  const [zipFileName, setZipFileName] = useState<string>('');
  const isCancelledRef = useRef<boolean>(false);

  const safeProjectName = (projectName || '我的相册').trim().replace(/[/\\?%*:|"<>]/g, '_');

  // 打开时重置状态
  useEffect(() => {
    if (isOpen) {
      setIsExporting(false);
      setCurrentRenderIndex(0);
      setProgressPercent(0);
      setStatusMessage('');
      setLastRenderedThumb(null);
      setCompletedZipBlob(null);
      setZipFileName('');
      isCancelledRef.current = false;
    } else {
      isCancelledRef.current = true;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 格式化跨页导出文件名
  const getSpreadFileName = (spread: SpreadModel, index: number): string => {
    const prefix = (index + 1).toString().padStart(2, '0');
    if (index === 0 || spread.isCover) {
      return `${prefix}_封面.jpg`;
    }
    if (index === 1) {
      return `${prefix}_扉页(第01页).jpg`;
    }
    const leftP = spread.leftPage.pageNumber ? spread.leftPage.pageNumber.toString().padStart(2, '0') : '00';
    const rightP = spread.rightPage.pageNumber ? spread.rightPage.pageNumber.toString().padStart(2, '0') : '00';
    return `${prefix}_第${leftP}-${rightP}跨页.jpg`;
  };

  // 一键全书从第一页渲染到最后一页并打包为 ZIP
  const handleStartExportAll = async () => {
    if (isExporting || spreads.length === 0) return;

    setIsExporting(true);
    setProgressPercent(2);
    setStatusMessage('初始化全书导出引擎...');
    setCompletedZipBlob(null);
    isCancelledRef.current = false;

    const zip = new JSZip();
    const folder = zip.folder(safeProjectName) || zip;
    const totalSpreads = spreads.length;

    try {
      for (let i = 0; i < totalSpreads; i++) {
        if (isCancelledRef.current) break;

        setCurrentRenderIndex(i);
        const spread = spreads[i];
        const fileName = getSpreadFileName(spread, i);
        const spreadTitle = spread.name || (i === 0 ? '封面' : `第 ${i + 1} 跨页`);

        setStatusMessage(`正在高精渲染 (${i + 1}/${totalSpreads}): ${spreadTitle}...`);

        // 逐页执行 300 DPI 纯净离线渲染
        const result = await exportSpreadToPrintJpg({
          spread,
          bookSpec,
          photos,
          projectName,
          scope: 'spread',
          includeBleed: false,     // 纯净成品印刷图 (无多余外延)
          includeCropMarks: false, // 无裁切线
          targetDpi: 300,
          quality: 0.98,
        });

        if (isCancelledRef.current) break;

        // 添加到 ZIP 文件夹
        folder.file(fileName, result.blob);
        setLastRenderedThumb(result.dataUrl);

        const currentPct = Math.round(((i + 1) / totalSpreads) * 85);
        setProgressPercent(currentPct);
      }

      if (!isCancelledRef.current) {
        setStatusMessage('正在打包压缩为相册文件夹 (.ZIP)...');
        setProgressPercent(90);

        const zipBlob = await zip.generateAsync(
          {
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
          },
          (metadata) => {
            const zipPct = 90 + Math.round((metadata.percent / 100) * 10);
            setProgressPercent(Math.min(99, zipPct));
          }
        );

        const outZipName = `${safeProjectName}.zip`;
        setCompletedZipBlob(zipBlob);
        setZipFileName(outZipName);
        setProgressPercent(100);
        setStatusMessage('全书打包完成！');

        // 自动触发浏览器下载
        downloadBlob(zipBlob, outZipName);
      }
    } catch (err) {
      console.error('Batch export failed:', err);
      alert('导出全书印刷文件时发生异常，请重试。');
    } finally {
      setIsExporting(false);
    }
  };

  const handleManualRedownload = () => {
    if (completedZipBlob && zipFileName) {
      downloadBlob(completedZipBlob, zipFileName);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col"
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
                <span>导出全书 300 DPI 印刷文件</span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                从第一页到最后一页完整打包至「{safeProjectName}」文件夹
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              isCancelledRef.current = true;
              onClose();
            }}
            className="w-7 h-7 rounded-full hover:bg-neutral-200 text-neutral-400 hover:text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主体信息与进度区 */}
        <div className="p-6 space-y-5 text-neutral-700 text-xs">
          {/* 1. 相册基本信息卡片 */}
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 font-medium flex items-center gap-1.5">
                <FolderArchive className="w-4 h-4 text-[#76383d]" />
                <span>目标文件夹名称</span>
              </span>
              <span className="font-semibold text-neutral-900 font-mono text-xs">
                {safeProjectName}/
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60">
              <span className="text-neutral-500 font-medium flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-neutral-600" />
                <span>导出页面范围</span>
              </span>
              <span className="font-medium text-neutral-800">
                共 <strong className="text-[#76383d] font-bold">{spreads.length}</strong> 个跨页 (全部页面)
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60">
              <span className="text-neutral-500 font-medium flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>图像规格与品质</span>
              </span>
              <span className="font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                300 DPI · 印刷级超清 JPG
              </span>
            </div>
          </div>

          {/* 2. 导出进行中的实时进度与缩略图 */}
          {isExporting && (
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium text-neutral-800 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-[#76383d]" />
                  <span>{statusMessage}</span>
                </span>
                <span className="font-mono font-bold text-[#76383d] text-sm">
                  {progressPercent}%
                </span>
              </div>

              {/* 进度条 */}
              <div className="w-full bg-neutral-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#76383d] h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* 正在渲染的页面缩略图 */}
              {lastRenderedThumb && (
                <div className="mt-2 flex items-center space-x-3 p-2 bg-white rounded-lg border border-neutral-200/80">
                  <img
                    src={lastRenderedThumb}
                    alt="Page thumbnail"
                    className="w-16 h-10 object-cover rounded border border-neutral-200"
                  />
                  <div className="text-[11px] text-neutral-500 leading-tight">
                    <div className="text-neutral-800 font-medium">已就绪: 第 {currentRenderIndex + 1} 跨页</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">300 DPI 无裁切线纯净渲染</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. 导出完成后的状态卡片 */}
          {completedZipBlob && (
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-emerald-800 font-semibold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>全书已成功打包导出！</span>
                </div>
                <span className="text-xs text-emerald-700 font-mono">
                  {(completedZipBlob.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>

              <p className="text-[11px] text-emerald-700 leading-relaxed">
                ✓ 浏览器已自动开始下载 <strong>{zipFileName}</strong>。<br />
                ✓ 解压后即可得到以「{safeProjectName}」命名的文件夹，内含全书 300 DPI 印刷图。
              </p>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 bg-[#fafafa]">
          <button
            type="button"
            onClick={() => {
              isCancelledRef.current = true;
              onClose();
            }}
            className="px-4 py-2 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/80 rounded-lg transition-colors cursor-pointer"
          >
            {completedZipBlob ? '完成并关闭' : '取消'}
          </button>

          <div className="flex items-center space-x-2.5">
            {completedZipBlob ? (
              <button
                type="button"
                onClick={handleManualRedownload}
                className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>再次下载 ZIP 压缩包</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isExporting}
                onClick={handleStartExportAll}
                className="flex items-center space-x-2 px-5 py-2 bg-[#76383d] hover:bg-[#632c30] disabled:bg-[#76383d]/60 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer active:scale-95"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>正在批量导出全书 ({progressPercent}%)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>一键导出全书印刷文件 (.ZIP)</span>
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
