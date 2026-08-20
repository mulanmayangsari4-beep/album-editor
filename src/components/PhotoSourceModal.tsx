import React, { useState } from 'react';
import {
  X,
  Smartphone,
  FolderKanban,
  History,
  Cloud,
  Film,
  QrCode,
  CheckCircle2,
  Upload,
  Plus,
  Play,
  RotateCw,
  Image as ImageIcon,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { UploadedPhoto } from '../types/editor';

export type PhotoSourceTab = 'mobile' | 'projects' | 'history' | 'netdisk' | 'video';

interface PhotoSourceModalProps {
  isOpen: boolean;
  initialTab?: PhotoSourceTab;
  onClose: () => void;
  onImportPhotos: (photos: UploadedPhoto[]) => void;
}

export const PhotoSourceModal: React.FC<PhotoSourceModalProps> = ({
  isOpen,
  initialTab = 'mobile',
  onClose,
  onImportPhotos,
}) => {
  const [activeTab, setActiveTab] = useState<PhotoSourceTab>(initialTab);
  const [isSimulatingMobileUpload, setIsSimulatingMobileUpload] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [selectedProjectIndex, setSelectedProjectIndex] = useState<number>(0);
  const [selectedProjectPhotoIds, setSelectedProjectPhotoIds] = useState<Set<string>>(new Set());
  const [videoTimestamp, setVideoTimestamp] = useState<number>(12); // 秒

  if (!isOpen) return null;

  // Mock 1: 历史作品数据 (严格遵循 assetId 引用体系，不污染 Base64)
  const MOCK_OTHER_PROJECTS = [
    {
      id: 'proj_travel_2025',
      name: '2025 新疆独库公路旅行画册',
      updatedAt: '2025-09-18',
      photoCount: 4,
      photos: [
        {
          id: 'asset_other_1',
          assetId: 'asset_other_1',
          name: '独库公路_那拉提草原.jpg',
          url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
          thumbUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&auto=format&fit=crop&q=80',
          naturalWidth: 3840,
          naturalHeight: 2160,
          fileSize: 3200000,
          usedCount: 0,
          aspectRatio: 'horizontal' as const,
          createdAt: Date.now() - 86400000 * 30,
          captureTime: Date.now() - 86400000 * 32,
        },
        {
          id: 'asset_other_2',
          assetId: 'asset_other_2',
          name: '赛里木湖_大西洋最后一滴眼泪.jpg',
          url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&fit=crop&q=80',
          thumbUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&auto=format&fit=crop&q=80',
          naturalWidth: 3840,
          naturalHeight: 2400,
          fileSize: 2890000,
          usedCount: 0,
          aspectRatio: 'horizontal' as const,
          createdAt: Date.now() - 86400000 * 30,
          captureTime: Date.now() - 86400000 * 33,
        },
        {
          id: 'asset_other_3',
          assetId: 'asset_other_3',
          name: '喀赞其蓝色小巷.jpg',
          url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&auto=format&fit=crop&q=80',
          thumbUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&auto=format&fit=crop&q=80',
          naturalWidth: 2400,
          naturalHeight: 3600,
          fileSize: 2100000,
          usedCount: 0,
          aspectRatio: 'vertical' as const,
          createdAt: Date.now() - 86400000 * 30,
          captureTime: Date.now() - 86400000 * 34,
        },
        {
          id: 'asset_other_4',
          assetId: 'asset_other_4',
          name: '琼库什台落日余晖.jpg',
          url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80',
          thumbUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&auto=format&fit=crop&q=80',
          naturalWidth: 3840,
          naturalHeight: 2560,
          fileSize: 3400000,
          usedCount: 0,
          aspectRatio: 'horizontal' as const,
          createdAt: Date.now() - 86400000 * 30,
          captureTime: Date.now() - 86400000 * 35,
        },
      ],
    },
    {
      id: 'proj_baby_2024',
      name: '2024 宝宝三周岁成长纪念',
      updatedAt: '2024-12-20',
      photoCount: 2,
      photos: [
        {
          id: 'asset_other_5',
          assetId: 'asset_other_5',
          name: '生日蛋糕吹蜡烛.jpg',
          url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80',
          thumbUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&auto=format&fit=crop&q=80',
          naturalWidth: 3000,
          naturalHeight: 3000,
          fileSize: 2200000,
          usedCount: 0,
          aspectRatio: 'square' as const,
          createdAt: Date.now() - 86400000 * 90,
          captureTime: Date.now() - 86400000 * 92,
        },
        {
          id: 'asset_other_6',
          assetId: 'asset_other_6',
          name: '公园草坪奔跑.jpg',
          url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&auto=format&fit=crop&q=80',
          thumbUrl: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&auto=format&fit=crop&q=80',
          naturalWidth: 3600,
          naturalHeight: 2400,
          fileSize: 2500000,
          usedCount: 0,
          aspectRatio: 'horizontal' as const,
          createdAt: Date.now() - 86400000 * 90,
          captureTime: Date.now() - 86400000 * 95,
        },
      ],
    },
  ];

  // Mock 2: 云端历史照片库
  const MOCK_HISTORY_PHOTOS: UploadedPhoto[] = [
    {
      id: 'asset_hist_1',
      assetId: 'asset_hist_1',
      name: '京都伏见稻荷千本鸟居.jpg',
      url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=80',
      thumbUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&auto=format&fit=crop&q=80',
      naturalWidth: 3600,
      naturalHeight: 2400,
      fileSize: 2650000,
      usedCount: 0,
      aspectRatio: 'horizontal',
      createdAt: Date.now() - 86400000 * 15,
      captureTime: Date.now() - 86400000 * 18,
    },
    {
      id: 'asset_hist_2',
      assetId: 'asset_hist_2',
      name: '富士山下樱花盛开.jpg',
      url: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?w=800&auto=format&fit=crop&q=80',
      thumbUrl: 'https://images.unsplash.com/photo-1528164344705-475426879c0d?w=400&auto=format&fit=crop&q=80',
      naturalWidth: 3840,
      naturalHeight: 2560,
      fileSize: 3100000,
      usedCount: 0,
      aspectRatio: 'horizontal',
      createdAt: Date.now() - 86400000 * 15,
      captureTime: Date.now() - 86400000 * 19,
    },
    {
      id: 'asset_hist_3',
      assetId: 'asset_hist_3',
      name: '海边灯塔与日落.jpg',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
      thumbUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&auto=format&fit=crop&q=80',
      naturalWidth: 2400,
      naturalHeight: 3600,
      fileSize: 2400000,
      usedCount: 0,
      aspectRatio: 'vertical',
      createdAt: Date.now() - 86400000 * 45,
      captureTime: Date.now() - 86400000 * 50,
    },
    {
      id: 'asset_hist_4',
      assetId: 'asset_hist_4',
      name: '城市天际线星空夜景.jpg',
      url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&auto=format&fit=crop&q=80',
      thumbUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&auto=format&fit=crop&q=80',
      naturalWidth: 3840,
      naturalHeight: 2160,
      fileSize: 3500000,
      usedCount: 0,
      aspectRatio: 'horizontal',
      createdAt: Date.now() - 86400000 * 60,
      captureTime: Date.now() - 86400000 * 62,
    },
  ];

  // 模拟手机上传完成并加入资产库
  const handleSimulateMobileUpload = () => {
    setIsSimulatingMobileUpload(true);
    setTimeout(() => {
      const mockMobilePhotos: UploadedPhoto[] = [
        {
          id: `asset_mobile_${Date.now()}_1`,
          assetId: `asset_mobile_${Date.now()}_1`,
          name: `IMG_${Math.floor(1000 + Math.random() * 9000)}_手机原图.jpg`,
          url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80',
          thumbUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
          naturalWidth: 3024,
          naturalHeight: 4032,
          fileSize: 2840000,
          usedCount: 0,
          aspectRatio: 'vertical',
          createdAt: Date.now(),
          captureTime: Date.now() - 3600000 * 2,
        },
        {
          id: `asset_mobile_${Date.now()}_2`,
          assetId: `asset_mobile_${Date.now()}_2`,
          name: `IMG_${Math.floor(1000 + Math.random() * 9000)}_旅途合影.jpg`,
          url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&auto=format&fit=crop&q=80',
          thumbUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
          naturalWidth: 4032,
          naturalHeight: 3024,
          fileSize: 3120000,
          usedCount: 0,
          aspectRatio: 'horizontal',
          createdAt: Date.now() + 1,
          captureTime: Date.now() - 3600000 * 3,
        },
      ];
      setIsSimulatingMobileUpload(false);
      onImportPhotos(mockMobilePhotos);
      onClose();
    }, 1200);
  };

  // 导入从其他作品选中的照片
  const handleImportProjectPhotos = () => {
    const currentProj = MOCK_OTHER_PROJECTS[selectedProjectIndex];
    if (!currentProj) return;
    const toImport = currentProj.photos.filter((p) => selectedProjectPhotoIds.has(p.id));
    if (toImport.length > 0) {
      onImportPhotos(toImport);
      onClose();
    }
  };

  // 导入选中的历史照片
  const handleImportHistoryPhotos = () => {
    const toImport = MOCK_HISTORY_PHOTOS.filter((p) => selectedHistoryIds.has(p.id));
    if (toImport.length > 0) {
      onImportPhotos(toImport);
      onClose();
    }
  };

  // 提取视频帧并加入资产库
  const handleExtractVideoFrame = () => {
    const extractedPhoto: UploadedPhoto = {
      id: `asset_video_${Date.now()}`,
      assetId: `asset_video_${Date.now()}`,
      name: `VID_FRAME_${videoTimestamp}s_提取照片.jpg`,
      url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&auto=format&fit=crop&q=80',
      thumbUrl: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&auto=format&fit=crop&q=80',
      naturalWidth: 3840,
      naturalHeight: 2160,
      fileSize: 2450000,
      usedCount: 0,
      aspectRatio: 'horizontal',
      createdAt: Date.now(),
      captureTime: Date.now() - 3600000 * 5,
    };
    onImportPhotos([extractedPhoto]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in select-none">
      <div
        className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl flex flex-col h-[580px] overflow-hidden border border-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 bg-[#fbfbfb]">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-neutral-800">照片资产中心 · 多渠道导入</h2>
            <span className="text-[11px] text-neutral-400">保留高质量原始分辨率与 EXIF 拍摄信息</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 主体左右分栏 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧通道导航 Tab */}
          <div className="w-48 bg-[#f5f6f8] border-r border-neutral-200 p-2 space-y-1 shrink-0">
            <button
              onClick={() => setActiveTab('mobile')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                activeTab === 'mobile'
                  ? 'bg-white text-[#76383d] font-bold shadow-xs border border-neutral-200/80'
                  : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              <Smartphone className="w-4 h-4 text-[#76383d]" />
              <span>手机扫码上传</span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                activeTab === 'projects'
                  ? 'bg-white text-[#76383d] font-bold shadow-xs border border-neutral-200/80'
                  : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              <FolderKanban className="w-4 h-4 text-amber-600" />
              <span>从其他作品选择</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-[#76383d] font-bold shadow-xs border border-neutral-200/80'
                  : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              <History className="w-4 h-4 text-blue-600" />
              <span>云端历史照片</span>
            </button>

            <button
              onClick={() => setActiveTab('netdisk')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                activeTab === 'netdisk'
                  ? 'bg-white text-[#76383d] font-bold shadow-xs border border-neutral-200/80'
                  : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              <Cloud className="w-4 h-4 text-cyan-600" />
              <span>百度网盘导入</span>
            </button>

            <button
              onClick={() => setActiveTab('video')}
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                activeTab === 'video'
                  ? 'bg-white text-[#76383d] font-bold shadow-xs border border-neutral-200/80'
                  : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              <Film className="w-4 h-4 text-purple-600" />
              <span>视频截帧提取</span>
            </button>
          </div>

          {/* 右侧主内容展示区 */}
          <div className="flex-1 flex flex-col justify-between p-5 overflow-y-auto bg-white">
            {/* 1. 手机扫码上传 */}
            {activeTab === 'mobile' && (
              <div className="flex flex-col items-center justify-center flex-1 space-y-4 py-4">
                <div className="p-4 bg-white border-2 border-neutral-200 rounded-xl shadow-xs flex flex-col items-center">
                  <div className="w-40 h-40 bg-neutral-50 rounded border border-neutral-200 flex flex-col items-center justify-center relative group">
                    <QrCode className="w-28 h-28 text-neutral-800" />
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-2xs flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[11px] font-semibold text-[#76383d]">会话通道就绪</span>
                      <span className="text-[9px] text-neutral-500 font-mono mt-0.5">ID: SESS_MIMO_9921</span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-medium text-neutral-700">使用微信或系统相机扫码</p>
                </div>

                <div className="text-center space-y-1 max-w-sm">
                  <p className="text-xs text-neutral-600">
                    手机端可直接选择多张高清原图上传，上传完成后照片将自动同步至当前画册照片池。
                  </p>
                  <p className="text-[11px] text-neutral-400">已开启端到端无损直传通道</p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSimulateMobileUpload}
                    disabled={isSimulatingMobileUpload}
                    className="px-4 py-2 bg-[#76383d] hover:bg-[#632c30] text-white text-xs font-medium rounded-md shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSimulatingMobileUpload ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>正在同步手机照片数据...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>模拟手机上传完成 (导入 2 张)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 2. 从其他作品选择 */}
            {activeTab === 'projects' && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                  <div className="text-xs font-medium text-neutral-600">选择历史作品</div>
                  <div className="flex space-x-1 text-xs">
                    {MOCK_OTHER_PROJECTS.map((proj, idx) => (
                      <button
                        key={proj.id}
                        onClick={() => {
                          setSelectedProjectIndex(idx);
                          setSelectedProjectPhotoIds(new Set());
                        }}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                          selectedProjectIndex === idx
                            ? 'bg-[#76383d] text-white font-medium'
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        }`}
                      >
                        {proj.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 作品照片预览网格 */}
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-4 gap-2.5">
                    {MOCK_OTHER_PROJECTS[selectedProjectIndex].photos.map((photo) => {
                      const isSelected = selectedProjectPhotoIds.has(photo.id);
                      return (
                        <div
                          key={photo.id}
                          onClick={() => {
                            const next = new Set(selectedProjectPhotoIds);
                            if (next.has(photo.id)) next.delete(photo.id);
                            else next.add(photo.id);
                            setSelectedProjectPhotoIds(next);
                          }}
                          className={`group relative aspect-square rounded-lg bg-neutral-100 overflow-hidden cursor-pointer border-2 transition-all ${
                            isSelected ? 'border-[#76383d] shadow-sm' : 'border-transparent hover:border-neutral-300'
                          }`}
                        >
                          <img
                            src={photo.thumbUrl}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                          />
                          <div
                            className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                              isSelected ? 'bg-[#76383d] text-white' : 'bg-black/40 text-transparent group-hover:text-white'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[10px] text-white truncate px-1.5">
                            {photo.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 底部确认栏 */}
                <div className="pt-3 border-t border-neutral-200 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">
                    已勾选 {selectedProjectPhotoIds.size} 张照片 (保持 assetId 纯净引用)
                  </span>
                  <button
                    onClick={handleImportProjectPhotos}
                    disabled={selectedProjectPhotoIds.size === 0}
                    className="px-4 py-2 bg-[#76383d] hover:bg-[#632c30] text-white rounded text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    导入选中照片到当前画册
                  </button>
                </div>
              </div>
            )}

            {/* 3. 云端历史照片 */}
            {activeTab === 'history' && (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between pb-1 text-xs text-neutral-500">
                  <span>过往上传的云端素材资产库 (点击选择导入)</span>
                  <button
                    onClick={() => {
                      if (selectedHistoryIds.size === MOCK_HISTORY_PHOTOS.length) {
                        setSelectedHistoryIds(new Set());
                      } else {
                        setSelectedHistoryIds(new Set(MOCK_HISTORY_PHOTOS.map((p) => p.id)));
                      }
                    }}
                    className="text-[#76383d] hover:underline text-xs"
                  >
                    {selectedHistoryIds.size === MOCK_HISTORY_PHOTOS.length ? '取消全选' : '全选全部'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-4 gap-2.5">
                    {MOCK_HISTORY_PHOTOS.map((photo) => {
                      const isSelected = selectedHistoryIds.has(photo.id);
                      return (
                        <div
                          key={photo.id}
                          onClick={() => {
                            const next = new Set(selectedHistoryIds);
                            if (next.has(photo.id)) next.delete(photo.id);
                            else next.add(photo.id);
                            setSelectedHistoryIds(next);
                          }}
                          className={`group relative aspect-square rounded-lg bg-neutral-100 overflow-hidden cursor-pointer border-2 transition-all ${
                            isSelected ? 'border-[#76383d] shadow-sm' : 'border-transparent hover:border-neutral-300'
                          }`}
                        >
                          <img
                            src={photo.thumbUrl}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                          />
                          <div
                            className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                              isSelected ? 'bg-[#76383d] text-white' : 'bg-black/40 text-transparent group-hover:text-white'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[10px] text-white truncate px-1.5">
                            {photo.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-200 flex items-center justify-between">
                  <span className="text-xs text-neutral-500">已选择 {selectedHistoryIds.size} 张云端照片</span>
                  <button
                    onClick={handleImportHistoryPhotos}
                    disabled={selectedHistoryIds.size === 0}
                    className="px-4 py-2 bg-[#76383d] hover:bg-[#632c30] text-white rounded text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    导入至照片池
                  </button>
                </div>
              </div>
            )}

            {/* 4. 百度网盘导入 */}
            {activeTab === 'netdisk' && (
              <div className="flex flex-col h-full justify-between space-y-4">
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg flex items-start space-x-3">
                  <Cloud className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-sky-900">百度网盘开放平台授权接入</p>
                    <p className="text-sky-700 leading-relaxed">
                      支持直接读取百度网盘中的相册、家庭共享目录及原图备份文件，免去本地重复下载流程。
                    </p>
                  </div>
                </div>

                <div className="border border-neutral-200 rounded-lg p-3 space-y-2 bg-[#fafafa]">
                  <div className="text-xs font-medium text-neutral-600 flex items-center justify-between pb-1 border-b border-neutral-200">
                    <span>我的网盘目录 / 我的照片 / 2026全家福</span>
                    <span className="text-[11px] text-neutral-400">预留 Adapter 独立通道</span>
                  </div>
                  <div className="space-y-1 text-xs text-neutral-700 py-2">
                    <div className="flex items-center justify-between p-2 hover:bg-white rounded border border-transparent hover:border-neutral-200 transition-colors">
                      <div className="flex items-center space-x-2">
                        <ImageIcon className="w-4 h-4 text-neutral-500" />
                        <span>IMG_20260215_大年夜全家福.RAW (28.4MB)</span>
                      </div>
                      <span className="text-[11px] text-emerald-600 font-medium">支持云端直读</span>
                    </div>
                    <div className="flex items-center justify-between p-2 hover:bg-white rounded border border-transparent hover:border-neutral-200 transition-colors">
                      <div className="flex items-center space-x-2">
                        <ImageIcon className="w-4 h-4 text-neutral-500" />
                        <span>IMG_20260216_庙会抓拍.JPG (8.2MB)</span>
                      </div>
                      <span className="text-[11px] text-emerald-600 font-medium">支持云端直读</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-200 flex items-center justify-end">
                  <button
                    onClick={() => {
                      const mockNetdiskPhoto: UploadedPhoto = {
                        id: `asset_netdisk_${Date.now()}`,
                        assetId: `asset_netdisk_${Date.now()}`,
                        name: 'IMG_20260215_百度网盘原图.jpg',
                        url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80',
                        thumbUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&auto=format&fit=crop&q=80',
                        naturalWidth: 4000,
                        naturalHeight: 2667,
                        fileSize: 4200000,
                        usedCount: 0,
                        aspectRatio: 'horizontal',
                        createdAt: Date.now(),
                        captureTime: Date.now() - 86400000 * 2,
                      };
                      onImportPhotos([mockNetdiskPhoto]);
                      onClose();
                    }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    从网盘导入示例照片
                  </button>
                </div>
              </div>
            )}

            {/* 5. 视频截帧提取 */}
            {activeTab === 'video' && (
              <div className="flex flex-col h-full justify-between space-y-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-neutral-800">4K / 1080P 视频关键帧智能提取</h3>
                  <p className="text-[11px] text-neutral-500">
                    支持在视频时间轴中精确定位精彩瞬间，一键提取为 300 DPI 印刷级静态照片资产。
                  </p>
                </div>

                {/* 视频模拟播放器 */}
                <div className="relative aspect-video bg-neutral-900 rounded-lg overflow-hidden flex items-center justify-center border border-neutral-300 group">
                  <img
                    src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&auto=format&fit=crop&q=80"
                    alt="Video preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform">
                      <Play className="w-5 h-5 text-neutral-800 fill-neutral-800 ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                    4K UHD · 00:00:{String(videoTimestamp).padStart(2, '0')} / 00:01:45
                  </div>
                </div>

                {/* 时间轴滑块 */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-neutral-600 font-mono">
                    <span>截帧时间点: 00:00:{String(videoTimestamp).padStart(2, '0')}</span>
                    <span>超清静止帧 (3840 × 2160)</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={videoTimestamp}
                    onChange={(e) => setVideoTimestamp(parseInt(e.target.value, 10))}
                    className="w-full accent-[#76383d] cursor-pointer"
                  />
                </div>

                <div className="pt-3 border-t border-neutral-200 flex items-center justify-end">
                  <button
                    onClick={handleExtractVideoFrame}
                    className="px-4 py-2 bg-[#76383d] hover:bg-[#632c30] text-white rounded text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>提取该时间点静止帧入相册</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
