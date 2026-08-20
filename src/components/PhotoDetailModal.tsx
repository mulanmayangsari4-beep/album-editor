import React from 'react';
import { X, Calendar, HardDrive, Image as ImageIcon, CheckCircle, Info, Maximize2, ShieldCheck } from 'lucide-react';
import { UploadedPhoto } from '../types/editor';
import { formatBytes, formatDateTime } from '../utils/imageUtils';

interface PhotoDetailModalProps {
  photo: UploadedPhoto | null;
  isOpen: boolean;
  onClose: () => void;
  onFillActiveSlot?: (photoId: string) => void;
  hasActiveSlot?: boolean;
}

export const PhotoDetailModal: React.FC<PhotoDetailModalProps> = ({
  photo,
  isOpen,
  onClose,
  onFillActiveSlot,
  hasActiveSlot,
}) => {
  if (!isOpen || !photo) return null;

  const captureTimeFormatted = photo.captureTime ? formatDateTime(photo.captureTime) : '未知';
  const uploadTimeFormatted = formatDateTime(photo.createdAt);
  const sizeFormatted = photo.fileSize ? formatBytes(photo.fileSize) : '未知';

  const aspectLabelMap = {
    horizontal: '横向构图 (Landscape)',
    vertical: '纵向构图 (Portrait)',
    square: '正方形 (1:1 Square)',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white transition-colors cursor-pointer"
          title="关闭"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 左侧：大图展示区 (优先展示原始高清原图) */}
        <div className="flex-1 bg-neutral-950 flex items-center justify-center p-4 min-h-[300px] md:min-h-[500px] overflow-hidden relative group">
          <img
            src={photo.originalUrl || photo.original?.url || photo.url}
            alt={photo.name}
            referrerPolicy="no-referrer"
            className="max-h-[75vh] max-w-full object-contain rounded shadow-lg transition-transform duration-200"
          />
          {photo.usedCount > 0 && (
            <div className="absolute top-4 left-4 bg-[#76383d] text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-md flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>当前画册已引用 {photo.usedCount} 次</span>
            </div>
          )}
        </div>

        {/* 右侧：元数据详情与操作面板 */}
        <div className="w-full md:w-80 bg-[#fdfdfd] border-t md:border-t-0 md:border-l border-neutral-200 p-5 flex flex-col justify-between shrink-0">
          <div className="space-y-4 overflow-y-auto pr-1">
            {/* 文件名与状态 */}
            <div>
              <div className="flex items-center justify-between text-neutral-400 text-xs mb-1">
                <div className="flex items-center space-x-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#76383d]" />
                  <span className="font-medium text-neutral-600">照片资产信息</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {photo.uploadStatus === 'uploaded' ? '云端已同步' : '本地离线就绪'}
                </span>
              </div>
              <h3 className="text-sm font-bold text-neutral-900 break-all leading-snug" title={photo.name}>
                {photo.name}
              </h3>
            </div>

            {/* 详细参数列表 */}
            <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-500">原图分辨率</span>
                <span className="font-mono font-semibold text-neutral-900">
                  {photo.naturalWidth} × {photo.naturalHeight} px
                </span>
              </div>

              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-500">缩略图 / 预览</span>
                <span className="font-mono text-neutral-700 text-[11px]">
                  400px / 1200px 极速加速
                </span>
              </div>

              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-500">文件大小</span>
                <span className="font-mono font-medium text-neutral-800">{sizeFormatted}</span>
              </div>

              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-500">构图比例</span>
                <span className="font-medium text-neutral-800">{aspectLabelMap[photo.aspectRatio]}</span>
              </div>

              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-500">拍摄时间</span>
                <span className="font-mono font-medium text-neutral-800">{captureTimeFormatted}</span>
              </div>

              <div className="flex justify-between items-center text-neutral-600">
                <span className="text-neutral-500">上传导入</span>
                <span className="font-mono text-[11px] text-neutral-700">{uploadTimeFormatted}</span>
              </div>

              <div className="flex justify-between items-center text-neutral-600 pt-1 border-t border-neutral-200">
                <span className="text-neutral-500">资产编号 (assetId)</span>
                <span className="font-mono text-[10px] text-neutral-500 truncate max-w-[130px]" title={photo.assetId || photo.id}>
                  {photo.assetId || photo.id}
                </span>
              </div>
            </div>

            {/* 印刷品质评估 */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-semibold text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>印刷清晰度评估</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                {photo.naturalWidth >= 2000 && photo.naturalHeight >= 2000
                  ? '超高清晰度原图，支持跨页大片及大尺寸照片书 300 DPI 高精度印刷。'
                  : photo.naturalWidth >= 1000
                  ? '分辨率优良，适合中等尺寸及多图排版画框。'
                  : '小尺寸照片，建议放入较小画框以保证最佳印刷精细度。'}
              </p>
            </div>
          </div>

          {/* 底部按钮栏 */}
          <div className="pt-4 mt-2 border-t border-neutral-200 space-y-2">
            {hasActiveSlot && onFillActiveSlot && (
              <button
                onClick={() => {
                  onFillActiveSlot(photo.id);
                  onClose();
                }}
                className="w-full py-2.5 bg-[#76383d] hover:bg-[#632c30] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>放入当前选中的画框</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
