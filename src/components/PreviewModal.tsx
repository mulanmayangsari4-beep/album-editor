import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import { SpreadModel, UploadedPhoto, BookSpec } from '../types/editor';
import { getMomoBorderWidthPx } from './PhotoFrame';
import { getMomoMaskStyle } from '../utils/masks';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  spreads: SpreadModel[];
  photos: UploadedPhoto[];
  bookSpec: BookSpec;
}

const getMaskStyle = (maskShape?: string): React.CSSProperties => {
  return getMomoMaskStyle(maskShape);
};

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  spreads,
  photos,
  bookSpec,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const photoMap = new Map<string, UploadedPhoto>(photos.map((p) => [p.id, p]));

  if (!isOpen) return null;

  const currentSpread = spreads[currentIndex] || spreads[0];
  const totalSpreads = spreads.length;

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(totalSpreads - 1, prev + 1));
  };

  return (
    <div
      id="preview-fullscreen-modal"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col justify-between p-4 md:p-6 select-none animate-in fade-in duration-150"
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between text-white max-w-6xl w-full mx-auto">
        <div className="flex items-center space-x-2.5">
          <BookOpen className="w-5 h-5 text-[#d8b9be]" />
          <h2 className="text-sm md:text-base font-semibold">
            画册全屏仿真翻页 · {bookSpec.name}
          </h2>
          <span className="text-xs bg-neutral-800/80 text-neutral-300 px-2 py-0.5 rounded font-mono">
            {currentIndex + 1} / {totalSpreads} 跨页
          </span>
        </div>

        <button
          id="btn-close-preview"
          onClick={onClose}
          className="p-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title="关闭预览 (ESC)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 翻页画册主体区域 */}
      <div className="flex-1 flex items-center justify-center relative my-2">
        {/* 上一跨页按钮 */}
        <button
          id="btn-prev-spread-preview"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={`absolute left-2 md:left-12 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white z-30 transition-all ${
            currentIndex === 0 ? 'opacity-20 cursor-not-allowed' : 'hover:scale-105 cursor-pointer shadow-lg'
          }`}
          title="上一跨页"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* 仿真对折画册 */}
        <div className="w-[90vw] max-w-[880px] aspect-[2/1] bg-white rounded-xs shadow-2xl shadow-black/80 flex overflow-hidden relative border border-neutral-300">
          {/* 左页 */}
          <div
            style={{ backgroundColor: currentSpread.leftPage.backgroundColor || '#FFFFFF' }}
            className="w-1/2 h-full relative overflow-hidden border-r border-neutral-200"
          >
            {currentSpread.leftPage.slots.map((slot) => {
              if (slot.type === 'text') {
                return (
                  <div
                    key={slot.id}
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.width}%`,
                      height: `${slot.height}%`,
                    }}
                    className="absolute flex items-center justify-center p-1 text-center"
                  >
                    <span className="text-xs text-neutral-800 font-sans">{slot.text}</span>
                  </div>
                );
              }

              const photo = slot.photoId ? photoMap.get(slot.photoId) : undefined;
              const crop = slot.crop || { x: 50, y: 50, scale: 1, rotation: 0 };
              const hasBorder = !!(slot.borderWidth && slot.borderWidth > 0);
              return (
                <div
                  key={slot.id}
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                    opacity: slot.opacity !== undefined ? slot.opacity : 1,
                    transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
                    borderRadius:
                      slot.maskShape && slot.maskShape !== 'none'
                        ? undefined
                        : slot.borderRadius
                        ? `${slot.borderRadius}px`
                        : undefined,
                    boxShadow: hasBorder ? `0 0 0 ${getMomoBorderWidthPx(slot.borderWidth)}px ${slot.borderColor || '#ffffff'}` : undefined,
                    ...getMaskStyle(slot.maskShape),
                  }}
                  className={`absolute overflow-hidden flex items-center justify-center ${
                    photo ? 'bg-transparent' : 'bg-[#e2e3e5]'
                  }`}
                >
                  {photo && (
                    <img
                      src={photo.url}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{
                        transform: `scale(${crop.scale}) rotate(${crop.rotation || 0}deg) ${slot.flipH ? 'scaleX(-1)' : ''}`,
                        objectPosition: slot.fitMode === 'contain' ? 'center' : `${crop.x}% ${crop.y}%`,
                      }}
                      className={`w-full h-full ${slot.fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
                    />
                  )}
                </div>
              );
            })}
            <div className="absolute bottom-2 left-3 text-[10px] font-mono text-neutral-400">
              {currentSpread.leftPage.pageNumber > 0 ? `P${currentSpread.leftPage.pageNumber}` : ''}
            </div>
          </div>

          {/* 中央书脊折痕 */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-6 bg-gradient-to-r from-black/10 via-black/20 to-black/10 pointer-events-none z-10">
            <div className="w-[1px] h-full bg-black/25 mx-auto" />
          </div>

          {/* 右页 */}
          <div
            style={{ backgroundColor: currentSpread.rightPage.backgroundColor || '#FFFFFF' }}
            className="w-1/2 h-full relative overflow-hidden"
          >
            {currentSpread.rightPage.slots.map((slot) => {
              if (slot.type === 'text') {
                return (
                  <div
                    key={slot.id}
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.width}%`,
                      height: `${slot.height}%`,
                    }}
                    className="absolute flex items-center justify-center p-1 text-center"
                  >
                    <span className="text-xs text-neutral-800 font-sans">{slot.text}</span>
                  </div>
                );
              }

              const photo = slot.photoId ? photoMap.get(slot.photoId) : undefined;
              const crop = slot.crop || { x: 50, y: 50, scale: 1, rotation: 0 };
              const hasBorder = !!(slot.borderWidth && slot.borderWidth > 0);
              return (
                <div
                  key={slot.id}
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                    opacity: slot.opacity !== undefined ? slot.opacity : 1,
                    transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
                    borderRadius:
                      slot.maskShape && slot.maskShape !== 'none'
                        ? undefined
                        : slot.borderRadius
                        ? `${slot.borderRadius}px`
                        : undefined,
                    boxShadow: hasBorder ? `0 0 0 ${getMomoBorderWidthPx(slot.borderWidth)}px ${slot.borderColor || '#ffffff'}` : undefined,
                    ...getMaskStyle(slot.maskShape),
                  }}
                  className={`absolute overflow-hidden flex items-center justify-center ${
                    photo ? 'bg-transparent' : 'bg-[#e2e3e5]'
                  }`}
                >
                  {photo && (
                    <img
                      src={photo.url}
                      alt=""
                      referrerPolicy="no-referrer"
                      style={{
                        transform: `scale(${crop.scale}) rotate(${crop.rotation || 0}deg) ${slot.flipH ? 'scaleX(-1)' : ''}`,
                        objectPosition: slot.fitMode === 'contain' ? 'center' : `${crop.x}% ${crop.y}%`,
                      }}
                      className={`w-full h-full ${slot.fitMode === 'contain' ? 'object-contain' : 'object-cover'}`}
                    />
                  )}
                </div>
              );
            })}
            <div className="absolute bottom-2 right-3 text-[10px] font-mono text-neutral-400">
              {currentSpread.rightPage.pageNumber > 0 ? `P${currentSpread.rightPage.pageNumber}` : ''}
            </div>
          </div>
        </div>

        {/* 下一跨页按钮 */}
        <button
          id="btn-next-spread-preview"
          onClick={handleNext}
          disabled={currentIndex === totalSpreads - 1}
          className={`absolute right-2 md:right-12 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white z-30 transition-all ${
            currentIndex === totalSpreads - 1 ? 'opacity-20 cursor-not-allowed' : 'hover:scale-105 cursor-pointer shadow-lg'
          }`}
          title="下一跨页"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* 底部缩略点导航 */}
      <div className="flex items-center justify-center space-x-2 py-2">
        {spreads.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
              i === currentIndex ? 'bg-[#d8b9be] w-6' : 'bg-neutral-700 hover:bg-neutral-500'
            }`}
            title={`跳转至第 ${i + 1} 跨页`}
          />
        ))}
      </div>
    </div>
  );
};
