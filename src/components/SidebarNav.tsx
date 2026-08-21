import React from 'react';
import {
  Image as ImageIcon,
  Palette,
  LayoutGrid,
  Square,
  Sparkles,
  Bookmark,
  UploadCloud,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SidebarTab } from '../types/editor';

interface SidebarNavProps {
  activeTab: SidebarTab | null;
  onSelectTab: (tab: SidebarTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const IconStampSidebar: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* 经典贴纸/图章图标：圆角贴纸带右下角翻折卷边 (1:1 还原用户参考图) */}
    <path d="M 21 11.5 A 9.2 9.2 0 1 0 11.5 21" />
    <path d="M 11.5 21 C 12 16.2 16.2 12 21 11.5" />
    <path d="M 12.6 20.4 C 13.6 16.8 16.8 13.6 20.4 12.6" />
  </svg>
);

export const IconMaskSidebar: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="3.5" />
    <circle cx="12" cy="12" r="5" />
    <path d="M7 7 L9 9 M15 15 L17 17 M7 17 L9 15 M15 9 L17 7" strokeWidth="1.2" />
  </svg>
);

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
}) => {
  const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
    { id: 'photos', label: '照片', icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'design', label: '设计', icon: <Palette className="w-4 h-4" /> },
    { id: 'layouts', label: '版式', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'elements', label: '图章', icon: <IconStampSidebar className="w-4 h-4" /> },
    { id: 'masks', label: '蒙版', icon: <IconMaskSidebar className="w-4 h-4" /> },
    { id: 'backgrounds', label: '背景', icon: <Square className="w-4 h-4" /> },
    { id: 'themes', label: '主题', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'import', label: '导入', icon: <UploadCloud className="w-4 h-4" /> },
  ];

  return (
    <aside
      id="left-primary-sidebar-nav"
      className="w-14 bg-[#2b2c30] text-neutral-300 flex flex-col justify-between items-center py-2 select-none shrink-0 z-20 border-r border-[#202124]"
    >
      {/* 顶部各个主要功能 Tab */}
      <div className="w-full flex flex-col items-center space-y-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id && !isCollapsed;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`w-full py-2.5 flex flex-col items-center justify-center transition-all cursor-pointer relative group ${
                isActive
                  ? 'text-white bg-[#3e4046] font-medium'
                  : 'hover:text-neutral-100 hover:bg-[#34353a] text-neutral-400'
              }`}
              title={tab.label}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#76383d]" />
              )}
              <div className="mb-1">{tab.icon}</div>
              <span className="text-[11px] scale-90 tracking-tighter">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 底部折叠/展开按钮 */}
      <button
        id="btn-collapse-sidebar"
        onClick={onToggleCollapse}
        className="w-full py-2 flex flex-col items-center justify-center text-neutral-400 hover:text-white hover:bg-[#34353a] transition-all cursor-pointer"
        title={isCollapsed ? '展开面板' : '收起面板'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
        <span className="text-[10px] mt-0.5">{isCollapsed ? '展开' : '收起'}</span>
      </button>
    </aside>
  );
};
