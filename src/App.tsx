import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { SidebarNav } from './components/SidebarNav';
import { PhotoTray } from './components/PhotoTray';
import { SpreadCanvas } from './components/SpreadCanvas';
import { RightPagesSidebar } from './components/RightPagesSidebar';
import { PreviewModal } from './components/PreviewModal';
import { PrintExportModal } from './components/PrintExportModal';
import { MultiPageEditorModal } from './components/MultiPageEditorModal';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import {
  DEFAULT_BOOK_SPEC,
  createInitialSpreads,
  SAMPLE_PHOTOS,
} from './data/defaultTemplates';
import {
  SpreadModel,
  PageModel,
  UploadedPhoto,
  EditorViewConfig,
  PhotoCrop,
  BookSpec,
  ProductSpec,
  SidebarTab,
  FrameSlot,
  MaskShape,
  SpacingConfig,
  ProjectDocument,
  CURRENT_SCHEMA_VERSION,
} from './types/editor';
import { UserAccount } from './types/account';
import { projectService } from './services/projectService';
import { authService } from './services/authService';
import { pricingService } from './services/pricingService';
import { useAutoSave } from './services/autoSaveService';
import {
  createImmutableOrderSnapshot,
  migrateProjectDocument,
  normalizeSlot,
} from './utils/projectSerializer';
import {
  createLayoutAdapter,
  updateSlotInPages,
  updateSlotsInPage,
  updatePageInPages,
  reindexPagesForSpreads,
} from './utils/layoutAdapter';
import { MomoGlobalClipPaths, MOMO_MASK_DEFINITIONS } from './utils/masks';
import { PresetStamp, PRESET_STAMPS, svgToDataUrl } from './data/stamps';

export default function App() {
  const [bookSpec, setBookSpec] = useState<BookSpec>(DEFAULT_BOOK_SPEC);
  const [projectName, setProjectName] = useState<string>('我的照片书');

  // 【核心架构准则】：pages: PageModel[] 为系统唯一 Source of Truth 持久化状态
  const [pages, setPages] = useState<PageModel[]>(() => {
    const initialDoc = migrateProjectDocument({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: 'proj_default',
      title: '我的照片书',
      productSpec: DEFAULT_BOOK_SPEC,
      spreads: createInitialSpreads().map((s) => ({
        ...s,
        leftPage: {
          ...s.leftPage,
          slots: s.leftPage.slots.map((sl) =>
            normalizeSlot(sl, DEFAULT_BOOK_SPEC.widthMm, DEFAULT_BOOK_SPEC.heightMm)
          ),
        },
        rightPage: {
          ...s.rightPage,
          slots: s.rightPage.slots.map((sl) =>
            normalizeSlot(sl, DEFAULT_BOOK_SPEC.widthMm, DEFAULT_BOOK_SPEC.heightMm)
          ),
        },
      })),
      photos: SAMPLE_PHOTOS,
    });
    return initialDoc.pages;
  });

  // 纯逻辑适配层：从 pages + productSpec 实时派生视图渲染模型 (Read-only View Models)
  const layoutAdapter = useMemo(
    () => createLayoutAdapter(bookSpec.layoutMode || 'dual_spread'),
    [bookSpec.layoutMode]
  );

  const renderUnits = useMemo(
    () => layoutAdapter.adaptToRender(pages, bookSpec),
    [layoutAdapter, pages, bookSpec]
  );

  // 向下兼容现有 SpreadCanvas、RightPagesSidebar 等视图组件的 SpreadModel[] 适配映射 (只读派生数据)
  const spreads: SpreadModel[] = useMemo(() => {
    return renderUnits.map((u) => ({
      id: u.id,
      spreadIndex: u.unitIndex,
      name: u.title,
      isCover: u.isCover,
      leftPage: {
        id: u.leftPage.sourcePageId,
        pageNumber: u.leftPage.pageNumber,
        faceType: u.leftPage.faceType,
        isLeft: u.leftPage.isLeft,
        backgroundColor: u.leftPage.backgroundColor || '#ffffff',
        backgroundImage: u.leftPage.backgroundImage,
        slots: u.leftPage.elements as FrameSlot[],
        elements: u.leftPage.elements as FrameSlot[],
      },
      rightPage: u.rightPage
        ? {
            id: u.rightPage.sourcePageId,
            pageNumber: u.rightPage.pageNumber,
            faceType: u.rightPage.faceType,
            isLeft: u.rightPage.isLeft,
            backgroundColor: u.rightPage.backgroundColor || '#ffffff',
            backgroundImage: u.rightPage.backgroundImage,
            slots: u.rightPage.elements as FrameSlot[],
            elements: u.rightPage.elements as FrameSlot[],
          }
        : {
            id: `empty_right_${u.unitIndex}`,
            pageNumber: 0,
            faceType: 'inside_right',
            isLeft: false,
            backgroundColor: '#ffffff',
            slots: [],
            elements: [],
          },
    }));
  }, [renderUnits]);

  // 默认选中第 3 个跨页 (即第 4-5 跨页，与用户截图完全一致)
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState<number>(3);
  const [photos, setPhotos] = useState<UploadedPhoto[]>(SAMPLE_PHOTOS);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  // 多选槽位 ID 集合 (Ctrl / Cmd + 点击)
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  // 槽位内存剪贴板 (支持复制/剪切单选或多选画框及其内含照片与裁切参数)
  const [slotClipboard, setSlotClipboard] = useState<{
    slots: FrameSlot[];
    sourceSpreadIndex: number;
    sourcePageSide: 'left' | 'right';
  } | null>(null);
  // 连续粘贴次数计数器（用于实现每次粘贴递增偏移 +3%）
  const [pasteCount, setPasteCount] = useState<number>(0);
  // 当前聚焦选中的单页 ('left' | 'right' | null)
  const [activeSide, setActiveSide] = useState<'left' | 'right' | null>('left');
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isPrintExportOpen, setIsPrintExportOpen] = useState<boolean>(false);
  const [isMultiPageOpen, setIsMultiPageOpen] = useState<boolean>(false);

  // 多工程管理与用户身份状态
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string>('proj_default');
  const [currentProjectCreatedAt, setCurrentProjectCreatedAt] = useState<number>(Date.now());
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState<boolean>(false);

  // 全局轻量 Toast 提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // 初始加载用户身份与最近工程
  useEffect(() => {
    async function initProjectWorkspace() {
      try {
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
        const projects = await projectService.listUserProjects();
        if (projects.length > 0) {
          const firstProj = await projectService.openProject(projects[0].projectId);
          if (firstProj) {
            setCurrentProjectId(firstProj.id);
            setProjectName(firstProj.title);
            setBookSpec(firstProj.productSpec);
            setPages(firstProj.pages);
            setPhotos(firstProj.photos || []);
            setCurrentProjectCreatedAt(firstProj.createdAt || Date.now());
          }
        }
      } catch (err) {
        console.warn('初始化工程工作区提示:', err);
      }
    }
    initProjectWorkspace();
  }, []);

  // 派生当前正在编辑的完整 ProjectDocument 实体
  const currentDoc: ProjectDocument = useMemo(() => ({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: currentProjectId || 'proj_default',
    title: projectName,
    productSpec: bookSpec,
    pages,
    photos,
    createdAt: currentProjectCreatedAt,
    updatedAt: Date.now(),
  }), [currentProjectId, projectName, bookSpec, pages, photos, currentProjectCreatedAt]);

  // 自动防抖保存服务 (1000ms debounce 防抖)
  const { saveStatus, forceSaveNow } = useAutoSave(currentDoc, {
    debounceMs: 1000,
    enabled: !!currentProjectId,
  });

  // 解耦的商业价格计算引擎 (支持代理商/会员角色阶梯折算)
  const currentPriceBreakdown = useMemo(() => {
    return pricingService.calculatePrice({
      productSpec: bookSpec,
      pageCount: pages.length,
      quantity: 1,
      context: {
        role: currentUser?.role || 'agent',
        priceTier: currentUser?.tierId || 'tier_agent_gold',
      },
    });
  }, [bookSpec, pages.length, currentUser]);

  // 打开并切换作品 (完全隔离 pages 与工程上下文)
  const handleSelectProject = useCallback(async (projectId: string) => {
    try {
      const doc = await projectService.openProject(projectId);
      setCurrentProjectId(doc.id);
      setProjectName(doc.title);
      setBookSpec(doc.productSpec);
      setPages(doc.pages);
      setPhotos(doc.photos || []);
      setCurrentProjectCreatedAt(doc.createdAt || Date.now());
      setSelectedSlotId(null);
      setSelectedSlotIds([]);
      setCurrentSpreadIndex(1); // 默认定位到正文第 1 跨页
      setHistory([doc.pages]);
      setHistoryIndex(0);
      showToast(`已成功载入作品「${doc.title}」`);
    } catch (err: any) {
      console.error('切换作品失败:', err);
      showToast(`载入失败: ${err.message}`);
    }
  }, [showToast]);

  // 商业化草稿保存与快照处理 (直接写入唯一持久化数据源 pages 并同步更新作品库)
  const handleSaveProject = useCallback(() => {
    forceSaveNow();
    showToast('作品已成功保存到本地工程库');
  }, [forceSaveNow, showToast]);

  // 商业化加入购物车/下单：生成不可篡改的订单快照
  const handleAddToCart = useCallback(() => {
    const rawDoc: ProjectDocument = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: currentProjectId || `proj_${Date.now()}`,
      title: projectName,
      productSpec: bookSpec,
      pages,
      photos,
      createdAt: currentProjectCreatedAt,
      updatedAt: Date.now(),
    };
    const doc = migrateProjectDocument(rawDoc);
    const orderSnapshot = createImmutableOrderSnapshot({
      project: doc,
      quantity: 1,
      unitPrice: currentPriceBreakdown.subtotal,
      currency: 'CNY',
    });
    try {
      localStorage.setItem(`order_snapshot_${orderSnapshot.snapshotId}`, JSON.stringify(orderSnapshot));
      showToast(`已生成订单快照 (结算价: ${pricingService.formatPrice(currentPriceBreakdown.total)})`);
    } catch (e) {
      console.warn('Order snapshot cache note:', e);
    }
  }, [currentProjectId, projectName, bookSpec, pages, photos, currentProjectCreatedAt, currentPriceBreakdown, showToast]);

  // 侧边栏一级 Tab 状态与折叠状态
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab | null>('photos');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState<boolean>(false);

  // 照片间距固定对齐配置 (支持顶部栏以毫米 mm 设置固定间距，默认未勾选，用户可自由输入大小)
  const [spacingConfig, setSpacingConfig] = useState<SpacingConfig>({
    enabled: false,
    gapMm: 2,
  });

  // 视图辅助配置 (印刷出血线、安全区、网格、缩放比)
  const [viewConfig, setViewConfig] = useState<EditorViewConfig>({
    showBleed: true,
    showSafeZone: false,
    showGrid: false,
    zoomPercent: 100,
  });

  // 撤销 / 重做 历史栈 (存储 PageModel[][] 作为历史状态)
  const [history, setHistory] = useState<PageModel[][]>(() => [pages]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // 智能计算并自动贴合屏幕的最佳缩放比例 (Auto-Fit Zoom)
  const handleAutoFitToScreen = useCallback(() => {
    setViewConfig((prev) => ({ ...prev, zoomPercent: 100 }));
  }, []);

  // 记录历史快照
  const pushHistory = useCallback(
    (newPages: PageModel[]) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, newPages];
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  // 撤销
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setPages(history[nextIdx]);
    }
  }, [historyIndex, history]);

  // 重做
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setPages(history[nextIdx]);
    }
  }, [historyIndex, history]);

  // 动态同步计算每张照片在画册中的 usedCount (从 pages 提取)
  useEffect(() => {
    const counts = new Map<string, number>();
    pages.forEach((page) => {
      const slots = page.slots || page.elements || [];
      slots.forEach((s) => {
        if (s.photoId) counts.set(s.photoId, (counts.get(s.photoId) || 0) + 1);
      });
    });

    setPhotos((prev) =>
      prev.map((p) => ({
        ...p,
        usedCount: counts.get(p.id) || 0,
      }))
    );
  }, [pages]);

  // 选中槽位 (支持 Ctrl / Cmd 增量多选与反选，并自动识别当前操作所属单页)
  const handleSelectSlot = (slotId: string | null, isMultiToggle?: boolean) => {
    if (!slotId) {
      setSelectedSlotId(null);
      setSelectedSlotIds([]);
      return;
    }

    // 自动将当前活跃半面设置为所选槽位所在的单页
    const currentSpread = spreads[currentSpreadIndex];
    if (currentSpread) {
      if (currentSpread.leftPage.slots.some((s) => s.id === slotId)) {
        setActiveSide('left');
      } else if (currentSpread.rightPage.slots.some((s) => s.id === slotId)) {
        setActiveSide('right');
      }
    }

    if (isMultiToggle) {
      setSelectedSlotIds((prev) => {
        let currentList = prev;
        if (selectedSlotId && !currentList.includes(selectedSlotId)) {
          currentList = [...currentList, selectedSlotId];
        }

        let next: string[];
        if (currentList.includes(slotId)) {
          next = currentList.filter((id) => id !== slotId);
        } else {
          next = [...currentList, slotId];
        }

        setSelectedSlotId(next.length > 0 ? next[next.length - 1] : null);
        return next;
      });
    } else {
      setSelectedSlotId(slotId);
      setSelectedSlotIds([slotId]);
    }
  };

  // 批量直接设置选中的槽位（用于 Illustrator 风格框选）
  const handleSelectMultipleSlots = useCallback((slotIds: string[]) => {
    setSelectedSlotIds(slotIds);
    setSelectedSlotId(slotIds.length > 0 ? slotIds[slotIds.length - 1] : null);

    if (slotIds.length > 0) {
      const currentSpread = spreads[currentSpreadIndex];
      if (currentSpread) {
        if (currentSpread.leftPage.slots.some((s) => slotIds.includes(s.id))) {
          setActiveSide('left');
        } else if (currentSpread.rightPage.slots.some((s) => slotIds.includes(s.id))) {
          setActiveSide('right');
        }
      }
    }
  }, [spreads, currentSpreadIndex]);

  // 互换两个画框的照片 (支持同一页或跨左/右页，保持各自画框网格不变，直接写入 pages)
  const handleSwapSlotsPhotos = useCallback((slotIdA: string, slotIdB: string) => {
    let slotA: FrameSlot | undefined;
    let slotB: FrameSlot | undefined;

    for (const page of pages) {
      const rawSlots = page.slots || page.elements || [];
      for (const s of rawSlots) {
        if (s.id === slotIdA) slotA = s;
        if (s.id === slotIdB) slotB = s;
      }
    }

    if (!slotA || !slotB) return;

    const photoIdA = slotA.photoId;
    const photoIdB = slotB.photoId;

    const nextPages = pages.map((page) => {
      const rawSlots = page.slots || page.elements || [];
      if (!rawSlots.some((s) => s.id === slotIdA || s.id === slotIdB)) return page;

      const updatedSlots = rawSlots.map((s) => {
        if (s.id === slotIdA) {
          return {
            ...s,
            photoId: photoIdB,
            assetId: photoIdB,
            crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
          };
        }
        if (s.id === slotIdB) {
          return {
            ...s,
            photoId: photoIdA,
            assetId: photoIdA,
            crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
          };
        }
        return s;
      });

      return {
        ...page,
        slots: updatedSlots,
        elements: updatedSlots,
      };
    });

    setPages(nextPages);
    pushHistory(nextPages);
    setSelectedSlotId(slotIdB);
    setSelectedSlotIds([slotIdB]);
    setToastMessage('已互换两张照片（画框位置与尺寸保持不变）');
    setTimeout(() => setToastMessage(null), 2500);
  }, [pages, pushHistory]);

  // 跨页左右版面互换 (方案 A：整页版式结构、画框布局与照片整体对调，直接更新 pages)
  const handleSwapSpreadPagePhotos = useCallback((targetSpreadIndex?: number) => {
    const spreadIdx = targetSpreadIndex !== undefined ? targetSpreadIndex : currentSpreadIndex;
    const leftPageIdx = spreadIdx * 2;
    const rightPageIdx = spreadIdx * 2 + 1;
    if (leftPageIdx >= pages.length || rightPageIdx >= pages.length) return;

    const leftPage = pages[leftPageIdx];
    const rightPage = pages[rightPageIdx];

    const nextPages = [...pages];
    nextPages[leftPageIdx] = {
      ...leftPage,
      slots: rightPage.slots || rightPage.elements || [],
      elements: rightPage.slots || rightPage.elements || [],
      backgroundColor: rightPage.backgroundColor,
      backgroundImage: rightPage.backgroundImage,
    };
    nextPages[rightPageIdx] = {
      ...rightPage,
      slots: leftPage.slots || leftPage.elements || [],
      elements: leftPage.slots || leftPage.elements || [],
      backgroundColor: leftPage.backgroundColor,
      backgroundImage: leftPage.backgroundImage,
    };

    setPages(nextPages);
    pushHistory(nextPages);
  }, [pages, currentSpreadIndex, pushHistory]);

  // 批量删除多个选中的画框 (直接更新 pages)
  const handleDeleteMultipleSlotsAcrossPages = useCallback((slotIds: string[]) => {
    if (!slotIds || slotIds.length === 0) return;
    const deleteSet = new Set(slotIds);

    const nextPages = pages.map((page) => {
      const rawSlots = page.slots || page.elements || [];
      const updated = rawSlots.filter((s) => !deleteSet.has(s.id));
      return {
        ...page,
        slots: updated,
        elements: updated,
      };
    });

    setPages(nextPages);
    pushHistory(nextPages);
    setSelectedSlotId(null);
    setSelectedSlotIds([]);
  }, [pages, pushHistory]);

  // ---------------- 1:1 米莫印品 专业级画框剪贴板（Ctrl+C 复制 / Ctrl+X 剪切 / Ctrl+V 粘贴 / Ctrl+D 原地克隆） ----------------
  // 复制当前选中的单选或多选画框
  const handleCopySlots = useCallback(() => {
    const activeIds = selectedSlotIds.length > 0 ? selectedSlotIds : selectedSlotId ? [selectedSlotId] : [];
    if (activeIds.length === 0) return;

    const currentSpread = spreads[currentSpreadIndex];
    if (!currentSpread) return;

    const idSet = new Set(activeIds);
    // 检查画框所在的页面
    const leftSlots = currentSpread.leftPage.slots.filter((s) => idSet.has(s.id));
    const rightSlots = currentSpread.rightPage.slots.filter((s) => idSet.has(s.id));

    const sourceSlots = leftSlots.length > 0 ? leftSlots : rightSlots;
    const sourceSide: 'left' | 'right' = leftSlots.length > 0 ? 'left' : 'right';

    if (sourceSlots.length > 0) {
      setSlotClipboard({
        slots: JSON.parse(JSON.stringify(sourceSlots)),
        sourceSpreadIndex: currentSpreadIndex,
        sourcePageSide: sourceSide,
      });
      setPasteCount(0); // 重置连续粘贴计数器
    }
  }, [selectedSlotIds, selectedSlotId, spreads, currentSpreadIndex]);

  // 剪切当前选中的画框 (Ctrl + X)
  const handleCutSlots = useCallback(() => {
    const activeIds = selectedSlotIds.length > 0 ? selectedSlotIds : selectedSlotId ? [selectedSlotId] : [];
    if (activeIds.length === 0) return;

    handleCopySlots();
    handleDeleteMultipleSlotsAcrossPages(activeIds);
  }, [selectedSlotIds, selectedSlotId, handleCopySlots, handleDeleteMultipleSlotsAcrossPages]);

  // 粘贴画框 (Ctrl + V)，支持同页递增微量偏移 (+3%) 与跨页精准粘贴 (写入 pages)
  const handlePasteSlots = useCallback(() => {
    if (!slotClipboard || !slotClipboard.slots || slotClipboard.slots.length === 0) return;

    const currentSpread = spreads[currentSpreadIndex];
    if (!currentSpread) return;

    // 确定目标粘贴页面：优先 activeSide，次之 clipboard 原页面侧
    const targetSide: 'left' | 'right' = activeSide || slotClipboard.sourcePageSide || 'left';
    const isSamePage =
      currentSpreadIndex === slotClipboard.sourceSpreadIndex &&
      targetSide === slotClipboard.sourcePageSide;

    // 如果在同页多次粘贴，每次递增偏移 (例如第1次 +3%, 第2次 +6%)
    const offsetStep = 3;
    const offsetMultiplier = isSamePage ? pasteCount + 1 : pasteCount;
    const xOffset = offsetMultiplier * offsetStep;
    const yOffset = offsetMultiplier * offsetStep;

    const newSlotIds: string[] = [];
    const newSlots: FrameSlot[] = slotClipboard.slots.map((s, index) => {
      const newId = `slot_paste_${Date.now()}_${index}`;
      newSlotIds.push(newId);

      // 计算新位置并限制在 0-90% 范围内
      const newX = Math.min(90, Math.max(0, s.x + xOffset));
      const newY = Math.min(90, Math.max(0, s.y + yOffset));

      return normalizeSlot({
        ...s,
        id: newId,
        x: newX,
        y: newY,
      }, bookSpec.widthMm, bookSpec.heightMm);
    });

    const targetPageIdx = currentSpreadIndex * 2 + (targetSide === 'left' ? 0 : 1);
    if (targetPageIdx >= pages.length) return;

    const targetPageId = pages[targetPageIdx].id;
    const nextPages = updateSlotsInPage(pages, targetPageId, (existing) => [...existing, ...newSlots]);

    setPages(nextPages);
    pushHistory(nextPages);

    // 自动高亮选中新粘贴生成的画框
    setSelectedSlotIds(newSlotIds);
    setSelectedSlotId(newSlotIds[newSlotIds.length - 1]);
    setActiveSide(targetSide);
    setPasteCount((prev) => prev + 1);
  }, [slotClipboard, spreads, pages, currentSpreadIndex, activeSide, pasteCount, bookSpec, pushHistory]);

  // 快速就地原样克隆选中画框 (Ctrl + D)
  const handleDuplicateSelection = useCallback(() => {
    const activeIds = selectedSlotIds.length > 0 ? selectedSlotIds : selectedSlotId ? [selectedSlotId] : [];
    if (activeIds.length === 0) return;

    handleCopySlots();
    setTimeout(() => {
      handlePasteSlots();
    }, 0);
  }, [selectedSlotIds, selectedSlotId, handleCopySlots, handlePasteSlots]);

  // ---------------- 1:1 米莫印品 图层层级排序 (上移一层 / 下移一层 / 置于顶部 / 置于底部) ----------------
  const handleLayerOrder = useCallback((action: 'bringForward' | 'sendBackward' | 'bringToFront' | 'sendToBack') => {
    const activeIds = selectedSlotIds.length > 0 ? selectedSlotIds : selectedSlotId ? [selectedSlotId] : [];
    if (activeIds.length === 0) return;
    const selectedSet = new Set(activeIds);

    const reorderSlots = (slots: FrameSlot[]): FrameSlot[] => {
      const hasSelected = slots.some((s) => selectedSet.has(s.id));
      if (!hasSelected || slots.length <= 1) return slots;

      let newSlots = [...slots];

      if (action === 'bringForward') {
        for (let i = newSlots.length - 2; i >= 0; i--) {
          if (selectedSet.has(newSlots[i].id) && !selectedSet.has(newSlots[i + 1].id)) {
            const temp = newSlots[i];
            newSlots[i] = newSlots[i + 1];
            newSlots[i + 1] = temp;
          }
        }
      } else if (action === 'sendBackward') {
        for (let i = 1; i < newSlots.length; i++) {
          if (selectedSet.has(newSlots[i].id) && !selectedSet.has(newSlots[i - 1].id)) {
            const temp = newSlots[i];
            newSlots[i] = newSlots[i - 1];
            newSlots[i - 1] = temp;
          }
        }
      } else if (action === 'bringToFront') {
        const unselected = newSlots.filter((s) => !selectedSet.has(s.id));
        const selected = newSlots.filter((s) => selectedSet.has(s.id));
        newSlots = [...unselected, ...selected];
      } else if (action === 'sendToBack') {
        const unselected = newSlots.filter((s) => !selectedSet.has(s.id));
        const selected = newSlots.filter((s) => selectedSet.has(s.id));
        newSlots = [...selected, ...unselected];
      }

      return newSlots.map((s, idx) => ({ ...s, zIndex: idx + 1 }));
    };

    let hasChanged = false;
    const leftPageIdx = currentSpreadIndex * 2;
    const rightPageIdx = currentSpreadIndex * 2 + 1;

    const nextPages = pages.map((page, idx) => {
      if (idx !== leftPageIdx && idx !== rightPageIdx) return page;

      const rawSlots = page.slots || page.elements || [];
      const nextSlots = reorderSlots(rawSlots);

      if (nextSlots.some((s, i) => s.id !== rawSlots[i]?.id)) {
        hasChanged = true;
      }

      return {
        ...page,
        slots: nextSlots,
        elements: nextSlots,
      };
    });

    if (hasChanged) {
      setPages(nextPages);
      pushHistory(nextPages);
      const actionLabels: Record<string, string> = {
        bringForward: '已将图层向前上移一层',
        sendBackward: '已将图层向后下移一层',
        bringToFront: '已将图层置于最顶层',
        sendToBack: '已将图层置于最底层',
      };
      setToastMessage(actionLabels[action] || '已调整图层顺序');
      setTimeout(() => setToastMessage(null), 2000);
    } else {
      const boundaryLabels: Record<string, string> = {
        bringForward: '当前图层已在最顶层',
        sendBackward: '当前图层已在最底层',
        bringToFront: '当前图层已在最顶层',
        sendToBack: '当前图层已在最底层',
      };
      setToastMessage(boundaryLabels[action] || '无法继续调整');
      setTimeout(() => setToastMessage(null), 2000);
    }
  }, [selectedSlotIds, selectedSlotId, pages, currentSpreadIndex, pushHistory]);

  // 快捷键监听 (支持 Ctrl+Z, Ctrl+Y, Ctrl+C 复制, Ctrl+X 剪切, Ctrl+V 粘贴, Ctrl+D 克隆, Escape, Delete/Backspace 批量删除)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入文字时触发快捷键
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Ctrl + C: 复制选中的画框
      if (isCtrlOrCmd && key === 'c') {
        if (selectedSlotIds.length > 0 || selectedSlotId) {
          e.preventDefault();
          handleCopySlots();
        }
      }
      // Ctrl + X: 剪切选中的画框
      else if (isCtrlOrCmd && key === 'x') {
        if (selectedSlotIds.length > 0 || selectedSlotId) {
          e.preventDefault();
          handleCutSlots();
        }
      }
      // Ctrl + V: 粘贴画框
      else if (isCtrlOrCmd && key === 'v') {
        e.preventDefault();
        handlePasteSlots();
      }
      // Ctrl + D: 快速就地原样克隆
      else if (isCtrlOrCmd && key === 'd') {
        if (selectedSlotIds.length > 0 || selectedSlotId) {
          e.preventDefault();
          handleDuplicateSelection();
        }
      }
      // X 键或 Ctrl+X 当选了2个时：互换照片
      else if (key === 'x' && !isCtrlOrCmd && selectedSlotIds.length === 2) {
        e.preventDefault();
        handleSwapSlotsPhotos(selectedSlotIds[0], selectedSlotIds[1]);
      }
      // Ctrl + Z: 撤销 / Ctrl + Shift + Z: 重做
      else if (isCtrlOrCmd && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      // Ctrl + Y: 重做
      else if (isCtrlOrCmd && key === 'y') {
        e.preventDefault();
        handleRedo();
      }
      // Escape: 取消选中
      else if (e.key === 'Escape') {
        setSelectedSlotId(null);
        setSelectedSlotIds([]);
        setIsPreviewOpen(false);
      }
      // Delete / Backspace: 删除选中的画框
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSlotIds.length > 0) {
          e.preventDefault();
          handleDeleteMultipleSlotsAcrossPages(selectedSlotIds);
        } else if (selectedSlotId) {
          e.preventDefault();
          handleDeleteMultipleSlotsAcrossPages([selectedSlotId]);
        }
      }
      // Ctrl + ]: 图层上移
      else if (isCtrlOrCmd && (e.key === ']' || e.key === '}')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleLayerOrder('bringToFront');
        } else {
          handleLayerOrder('bringForward');
        }
      }
      // Ctrl + [: 图层下移
      else if (isCtrlOrCmd && (e.key === '[' || e.key === '{')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleLayerOrder('sendToBack');
        } else {
          handleLayerOrder('sendBackward');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    handleCopySlots,
    handleCutSlots,
    handlePasteSlots,
    handleDuplicateSelection,
    selectedSlotIds,
    selectedSlotId,
    spreads,
    currentSpreadIndex,
  ]);

  // 添加照片到托盘
  const handleAddPhotos = (newPhotos: UploadedPhoto[]) => {
    setPhotos((prev) => [...newPhotos, ...prev]);
  };

  // 从托盘删除照片 (清除 pages 中对此照片的引用)
  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    const nextPages = pages.map((page) => {
      const rawSlots = page.slots || page.elements || [];
      const updated = rawSlots.map((s) =>
        s.photoId === photoId ? { ...s, photoId: undefined, assetId: undefined, crop: undefined } : s
      );
      return { ...page, slots: updated, elements: updated };
    });
    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 将照片放入指定槽位 (写入 pages)
  const handleDropPhotoToSlot = (pageId: string, slotId: string, photoId: string) => {
    const nextPages = updateSlotInPages(pages, pageId, slotId, (s) => ({
      ...s,
      photoId,
      assetId: photoId,
      crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
    }));
    setPages(nextPages);
    pushHistory(nextPages);
    setSelectedSlotId(slotId);
  };

  // 点击照片填入当前选中的活跃槽位
  const handleFillActiveSlot = (photoId: string) => {
    if (!selectedSlotId) return;

    let targetPageId: string | null = null;
    const currentSpread = spreads[currentSpreadIndex];
    if (currentSpread.leftPage.slots.some((s) => s.id === selectedSlotId)) {
      targetPageId = currentSpread.leftPage.id;
    } else if (currentSpread.rightPage.slots.some((s) => s.id === selectedSlotId)) {
      targetPageId = currentSpread.rightPage.id;
    }

    if (targetPageId) {
      handleDropPhotoToSlot(targetPageId, selectedSlotId, photoId);
    }
  };

  // 执行替换照片 (严格遵循只换照片不换画框原则，写入 pages)
  const handleSwapSlotPhoto = useCallback((pageId: string, slotId: string, newPhotoId: string) => {
    const nextPages = updateSlotInPages(pages, pageId, slotId, (s) => ({
      ...s,
      photoId: newPhotoId,
      assetId: newPhotoId,
      crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
    }));

    setPages(nextPages);
    pushHistory(nextPages);
    setSelectedSlotId(slotId);
    setSelectedSlotIds([slotId]);

    const targetPhoto = photos.find((p) => p.id === newPhotoId);
    if (targetPhoto) {
      setToastMessage(`已更换为「${targetPhoto.name}」（画框保持不变）`);
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [pages, photos, pushHistory]);

  // 更新槽位裁剪/缩放参数 (写入 pages)
  const handleUpdateSlotCrop = (pageId: string, slotId: string, crop: PhotoCrop) => {
    const nextPages = updateSlotInPages(pages, pageId, slotId, (s) => ({
      ...s,
      crop,
    }));
    setPages(nextPages);
  };

  // 更新画框在页面上的坐标与尺寸 (DIY 自由排版，严格同步物理毫米真值，写入 pages)
  const handleUpdateSlotBounds = (
    pageId: string,
    slotId: string,
    bounds: { x: number; y: number; width: number; height: number; rotation?: number }
  ) => {
    const nextPages = updateSlotInPages(pages, pageId, slotId, (s) => {
      const x = bounds.x;
      const y = bounds.y;
      const width = bounds.width;
      const height = bounds.height;
      const xMm = Number(((x / 100) * bookSpec.widthMm).toFixed(2));
      const yMm = Number(((y / 100) * bookSpec.heightMm).toFixed(2));
      const widthMm = Number(((width / 100) * bookSpec.widthMm).toFixed(2));
      const heightMm = Number(((height / 100) * bookSpec.heightMm).toFixed(2));
      return {
        ...s,
        x,
        y,
        width,
        height,
        xMm,
        yMm,
        widthMm,
        heightMm,
        rotation: bounds.rotation !== undefined ? bounds.rotation : s.rotation,
      };
    });
    setPages(nextPages);
  };

  // 批量更新多个槽位的位置 (多选批量平移，严格同步物理毫米真值，写入 pages)
  const handleUpdateMultipleSlotsBounds = (
    pageId: string,
    updates: { slotId: string; bounds: { x: number; y: number; width: number; height: number; rotation?: number } }[]
  ) => {
    const updateMap = new Map(updates.map((u) => [u.slotId, u.bounds]));
    const nextPages = updateSlotsInPage(pages, pageId, (slots) =>
      slots.map((s) => {
        const b = updateMap.get(s.id);
        if (!b) return s;
        const x = b.x;
        const y = b.y;
        const width = b.width;
        const height = b.height;
        const xMm = Number(((x / 100) * bookSpec.widthMm).toFixed(2));
        const yMm = Number(((y / 100) * bookSpec.heightMm).toFixed(2));
        const widthMm = Number(((width / 100) * bookSpec.widthMm).toFixed(2));
        const heightMm = Number(((height / 100) * bookSpec.heightMm).toFixed(2));
        return {
          ...s,
          x,
          y,
          width,
          height,
          xMm,
          yMm,
          widthMm,
          heightMm,
          rotation: b.rotation !== undefined ? b.rotation : s.rotation,
        };
      })
    );
    setPages(nextPages);
  };

  // 提交画框位置变动到历史
  const handleCommitSlotBounds = () => {
    pushHistory(pages);
  };

  // 删除画框
  const handleDeleteSlot = (pageId: string, slotId: string) => {
    handleDeleteMultipleSlotsAcrossPages([slotId]);
  };

  // 复制画框 (写入 pages)
  const handleDuplicateSlot = (pageId: string, slotId: string) => {
    const targetPage = pages.find((p) => p.id === pageId);
    if (!targetPage) return;
    const rawSlots = targetPage.slots || targetPage.elements || [];
    const slotToClone = rawSlots.find((s) => s.id === slotId);
    if (!slotToClone) return;

    const clonedSlot: FrameSlot = normalizeSlot({
      ...slotToClone,
      id: `slot_dup_${Date.now()}`,
      x: Math.min(85, slotToClone.x + 4),
      y: Math.min(85, slotToClone.y + 4),
    }, bookSpec.widthMm, bookSpec.heightMm);

    const nextPages = updateSlotsInPage(pages, pageId, (slots) => [...slots, clonedSlot]);
    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 清除槽位照片 (写入 pages)
  const handleClearSlotPhoto = (pageId: string, slotId: string) => {
    const nextPages = updateSlotInPages(pages, pageId, slotId, (s) => ({
      ...s,
      photoId: undefined,
      assetId: undefined,
      crop: undefined,
    }));
    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 更新画框扩展属性 (遮罩、描边、圆角、不透明度、投影、适应模式、水平翻转等，写入 pages)
  const handleUpdateSlotProps = (pageId: string, slotId: string, newProps: Partial<FrameSlot>) => {
    const nextPages = updateSlotInPages(pages, pageId, slotId, (s) => ({
      ...s,
      ...newProps,
    }));
    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 应用蒙版到画框 (从左侧蒙版面板或快捷栏触发，写入 pages)
  const handleApplyMask = (maskId: MaskShape) => {
    let targetPageId: string | null = null;
    let targetSlotId: string | null = selectedSlotId;

    const currentSpread = spreads[currentSpreadIndex];
    if (targetSlotId && currentSpread) {
      if (currentSpread.leftPage.slots.some((s) => s.id === targetSlotId)) {
        targetPageId = currentSpread.leftPage.id;
      } else if (currentSpread.rightPage.slots.some((s) => s.id === targetSlotId)) {
        targetPageId = currentSpread.rightPage.id;
      }
    }

    // 如果未选定画框，但在当前活动页上有画框，则自动选取第 1 个画框应用
    if (!targetSlotId || !targetPageId) {
      const activeSidePage = (activeSide === 'right') ? currentSpread.rightPage : currentSpread.leftPage;
      if (activeSidePage.slots.length > 0) {
        targetPageId = activeSidePage.id;
        targetSlotId = activeSidePage.slots[0].id;
        setSelectedSlotId(targetSlotId);
        setSelectedSlotIds([targetSlotId]);
      } else {
        // 如果当前页没有画框，自动在当前页新增一个带该蒙版的画框
        const newSlot: FrameSlot = normalizeSlot({
          id: `slot_mask_${Date.now()}`,
          type: 'photo',
          x: 25,
          y: 25,
          width: 50,
          height: 50,
          maskShape: maskId,
        }, bookSpec.widthMm, bookSpec.heightMm);

        const pageToAddTo = (activeSide === 'right') ? currentSpread.rightPage.id : currentSpread.leftPage.id;
        const nextPages = updateSlotsInPage(pages, pageToAddTo, (slots) => [...slots, newSlot]);

        setPages(nextPages);
        pushHistory(nextPages);
        setSelectedSlotId(newSlot.id);
        setSelectedSlotIds([newSlot.id]);
        const maskDef = MOMO_MASK_DEFINITIONS.find((m) => m.id === maskId);
        setToastMessage(`已新建「${maskDef?.name || maskId}」蒙版画框`);
        setTimeout(() => setToastMessage(null), 2000);
        return;
      }
    }

    if (targetPageId && targetSlotId) {
      handleUpdateSlotProps(targetPageId, targetSlotId, { maskShape: maskId });
      const maskDef = MOMO_MASK_DEFINITIONS.find((m) => m.id === maskId);
      setToastMessage(`已应用「${maskDef?.name || maskId}」蒙版`);
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  // 添加图章到当前跨页 (写入 pages)
  const handleAddStamp = (stamp: PresetStamp) => {
    const currentSpread = spreads[currentSpreadIndex];
    if (!currentSpread) return;

    let targetSide: 'left' | 'right' = activeSide || 'left';

    if (selectedSlotId) {
      if (currentSpread.leftPage.slots.some((s) => s.id === selectedSlotId)) {
        targetSide = 'left';
      } else if (currentSpread.rightPage.slots.some((s) => s.id === selectedSlotId)) {
        targetSide = 'right';
      }
    }

    const dataUrl = svgToDataUrl(stamp.svgContent);
    const stampPhotoId = `stamp_asset_${stamp.id}`;

    const stampPhoto: UploadedPhoto = {
      id: stampPhotoId,
      assetId: stampPhotoId,
      name: stamp.name,
      url: dataUrl,
      thumbUrl: dataUrl,
      previewUrl: dataUrl,
      originalUrl: dataUrl,
      thumbnailUrl: dataUrl,
      naturalWidth: 400,
      naturalHeight: 400,
      fileSize: 1024,
      usedCount: 1,
      aspectRatio: 'square',
      createdAt: Date.now(),
      isSystemStamp: true,
    };

    setPhotos((prev) => {
      const exists = prev.some((p) => p.id === stampPhotoId);
      if (exists) return prev;
      return [stampPhoto, ...prev];
    });

    const wPercent = stamp.defaultWidthPercent || 22;
    const hPercent = stamp.defaultHeightPercent || 22;
    const targetPageSlots = targetSide === 'left' ? currentSpread.leftPage.slots : currentSpread.rightPage.slots;
    const maxZ = targetPageSlots.reduce((max, s) => Math.max(max, s.zIndex || 1), 1);

    const newSlot: FrameSlot = normalizeSlot({
      id: `slot_stamp_${Date.now()}`,
      type: 'photo',
      x: Number((Math.max(5, 50 - wPercent / 2 + (Math.random() * 6 - 3))).toFixed(2)),
      y: Number((Math.max(5, 50 - hPercent / 2 + (Math.random() * 6 - 3))).toFixed(2)),
      width: wPercent,
      height: hPercent,
      photoId: stampPhotoId,
      assetId: stampPhotoId,
      fitMode: 'contain',
      zIndex: maxZ + 1,
      crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
    }, bookSpec.widthMm, bookSpec.heightMm);

    const targetPageId = targetSide === 'left' ? currentSpread.leftPage.id : currentSpread.rightPage.id;
    const nextPages = updateSlotsInPage(pages, targetPageId, (slots) => [...slots, newSlot]);

    setPages(nextPages);
    pushHistory(nextPages);
    setSelectedSlotId(newSlot.id);
    setSelectedSlotIds([newSlot.id]);
    setActiveSide(targetSide);
    setToastMessage(`已将「${stamp.name}」图章添加至${targetSide === 'left' ? '左' : '右'}页`);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // 拖拽图章到画布精准落点放置 (写入 pages)
  const handleAddStampAtPosition = (pageId: string, stampId: string, positionPercent: { x: number; y: number }) => {
    const stamp = PRESET_STAMPS.find((s) => s.id === stampId);
    if (!stamp) return;

    const currentSpread = spreads[currentSpreadIndex];
    if (!currentSpread) return;

    const isLeft = currentSpread.leftPage.id === pageId;
    const targetPage = isLeft ? currentSpread.leftPage : currentSpread.rightPage;

    const dataUrl = svgToDataUrl(stamp.svgContent);
    const stampPhotoId = `stamp_asset_${stamp.id}`;

    const stampPhoto: UploadedPhoto = {
      id: stampPhotoId,
      assetId: stampPhotoId,
      name: stamp.name,
      url: dataUrl,
      thumbUrl: dataUrl,
      previewUrl: dataUrl,
      originalUrl: dataUrl,
      thumbnailUrl: dataUrl,
      naturalWidth: 400,
      naturalHeight: 400,
      fileSize: 1024,
      usedCount: 1,
      aspectRatio: 'square',
      createdAt: Date.now(),
      isSystemStamp: true,
    };

    setPhotos((prev) => {
      const exists = prev.some((p) => p.id === stampPhotoId);
      if (exists) return prev;
      return [stampPhoto, ...prev];
    });

    const wPercent = stamp.defaultWidthPercent || 22;
    const hPercent = stamp.defaultHeightPercent || 22;
    const maxZ = targetPage.slots.reduce((max, s) => Math.max(max, s.zIndex || 1), 1);

    const leftX = Math.max(2, Math.min(98 - wPercent, positionPercent.x - wPercent / 2));
    const topY = Math.max(2, Math.min(98 - hPercent, positionPercent.y - hPercent / 2));

    const newSlot: FrameSlot = normalizeSlot({
      id: `slot_stamp_${Date.now()}`,
      type: 'photo',
      x: Number(leftX.toFixed(2)),
      y: Number(topY.toFixed(2)),
      width: wPercent,
      height: hPercent,
      photoId: stampPhotoId,
      assetId: stampPhotoId,
      fitMode: 'contain',
      zIndex: maxZ + 1,
      crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
    }, bookSpec.widthMm, bookSpec.heightMm);

    const nextPages = updateSlotsInPage(pages, pageId, (slots) => [...slots, newSlot]);

    setPages(nextPages);
    pushHistory(nextPages);
    setSelectedSlotId(newSlot.id);
    setSelectedSlotIds([newSlot.id]);
    setActiveSide(isLeft ? 'left' : 'right');
    setToastMessage(`已将「${stamp.name}」放置在${isLeft ? '左' : '右'}页`);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // 画框一键满屏 (占满整页 100% 宽高，写入 pages)
  const handleMakeFullScreen = (pageId: string, slotId: string) => {
    const nextPages = updateSlotInPages(pages, pageId, slotId, (s) =>
      normalizeSlot(
        {
          ...s,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          xMm: 0,
          yMm: 0,
          widthMm: bookSpec.widthMm,
          heightMm: bookSpec.heightMm,
          rotation: 0,
        },
        bookSpec.widthMm,
        bookSpec.heightMm
      )
    );

    setPages(nextPages);
    pushHistory(nextPages);
    setToastMessage('已将照片画框一键满屏铺满整页');
    setTimeout(() => setToastMessage(null), 2000);
  };

  // 在左侧照片托盘中定位并高亮照片
  const handleLocatePhoto = (photoId: string) => {
    setActiveSidebarTab('photos');
    setIsSidebarCollapsed(false);
    setTimeout(() => {
      const el =
        document.getElementById(`photo-tray-item-${photoId}`) ||
        document.getElementById(`photo-card-${photoId}`) ||
        document.getElementById(`photo-item-${photoId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-[#76383d]', 'ring-offset-2');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-[#76383d]', 'ring-offset-2');
        }, 2000);
      }
    }, 120);
  };

  // 更新文本框内容 (写入 pages)
  const handleUpdateSlotText = (pageId: string, slotId: string, text: string) => {
    const nextPages = updateSlotInPages(pages, pageId, slotId, (s) => ({
      ...s,
      text,
    }));
    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 插入自定义图片框 (写入 pages)
  const handleAddImageSlot = () => {
    const currentSpread = spreads[currentSpreadIndex];
    let targetSide: 'left' | 'right' = activeSide || 'left';

    if (selectedSlotId && currentSpread) {
      if (currentSpread.leftPage.slots.some((s) => s.id === selectedSlotId)) {
        targetSide = 'left';
      } else if (currentSpread.rightPage.slots.some((s) => s.id === selectedSlotId)) {
        targetSide = 'right';
      }
    } else if (activeSide) {
      targetSide = activeSide;
    }

    const newSlot: FrameSlot = normalizeSlot({
      id: `slot_custom_${Date.now()}`,
      type: 'photo',
      x: 20,
      y: 20,
      width: 35,
      height: 35,
      pixelLabel: '1200x1200',
      placeholderText: '拖入图片',
    }, bookSpec.widthMm, bookSpec.heightMm);

    const targetPageId = targetSide === 'left' ? currentSpread.leftPage.id : currentSpread.rightPage.id;
    const nextPages = updateSlotsInPage(pages, targetPageId, (slots) => [...slots, newSlot]);

    setPages(nextPages);
    pushHistory(nextPages);
    setSelectedSlotId(newSlot.id);
    setSelectedSlotIds([newSlot.id]);
    setActiveSide(targetSide);
  };

  // 插入自定义文字框 (写入 pages)
  const handleAddTextSlot = () => {
    const currentSpread = spreads[currentSpreadIndex];
    let targetSide: 'left' | 'right' = activeSide || 'left';

    if (selectedSlotId && currentSpread) {
      if (currentSpread.leftPage.slots.some((s) => s.id === selectedSlotId)) {
        targetSide = 'left';
      } else if (currentSpread.rightPage.slots.some((s) => s.id === selectedSlotId)) {
        targetSide = 'right';
      }
    } else if (activeSide) {
      targetSide = activeSide;
    }

    const newSlot: FrameSlot = normalizeSlot({
      id: `slot_text_${Date.now()}`,
      type: 'text',
      x: 15,
      y: 75,
      width: 70,
      height: 10,
      text: '点击输入新文本',
      placeholderText: '点两次输入文字',
    }, bookSpec.widthMm, bookSpec.heightMm);

    const targetPageId = targetSide === 'left' ? currentSpread.leftPage.id : currentSpread.rightPage.id;
    const nextPages = updateSlotsInPage(pages, targetPageId, (slots) => [...slots, newSlot]);

    setPages(nextPages);
    pushHistory(nextPages);
    setSelectedSlotId(newSlot.id);
    setSelectedSlotIds([newSlot.id]);
    setActiveSide(targetSide);
  };

  // 应用单页版式到当前页 (写入 pages)
  const handleApplyLayoutToCurrentPage = (
    slots: FrameSlot[],
    targetPageSide: 'left' | 'right' | 'both'
  ) => {
    const leftPageIdx = currentSpreadIndex * 2;
    const rightPageIdx = currentSpreadIndex * 2 + 1;
    const nextPages = [...pages];

    if (targetPageSide === 'left' || targetPageSide === 'both') {
      if (leftPageIdx < nextPages.length) {
        const clonedSlots = slots.map((s, i) =>
          normalizeSlot({ ...s, id: `slot_${Date.now()}_${i}` }, bookSpec.widthMm, bookSpec.heightMm)
        );
        nextPages[leftPageIdx] = { ...nextPages[leftPageIdx], slots: clonedSlots, elements: clonedSlots };
      }
    }
    if (targetPageSide === 'right' || targetPageSide === 'both') {
      if (rightPageIdx < nextPages.length) {
        const clonedSlots = slots.map((sl, i) =>
          normalizeSlot({ ...sl, id: `slot_r_${Date.now()}_${i}` }, bookSpec.widthMm, bookSpec.heightMm)
        );
        nextPages[rightPageIdx] = { ...nextPages[rightPageIdx], slots: clonedSlots, elements: clonedSlots };
      }
    }

    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 应用跨页连通大片版式 (写入 pages)
  const handleApplySpreadLayout = (leftSlots: FrameSlot[], rightSlots: FrameSlot[]) => {
    const leftPageIdx = currentSpreadIndex * 2;
    const rightPageIdx = currentSpreadIndex * 2 + 1;
    const nextPages = [...pages];

    if (leftPageIdx < nextPages.length) {
      const clonedLeft = leftSlots.map((s, i) =>
        normalizeSlot({ ...s, id: `slot_sp_l_${Date.now()}_${i}` }, bookSpec.widthMm, bookSpec.heightMm)
      );
      nextPages[leftPageIdx] = { ...nextPages[leftPageIdx], slots: clonedLeft, elements: clonedLeft };
    }
    if (rightPageIdx < nextPages.length) {
      const clonedRight = rightSlots.map((s, i) =>
        normalizeSlot({ ...s, id: `slot_sp_r_${Date.now()}_${i}` }, bookSpec.widthMm, bookSpec.heightMm)
      );
      nextPages[rightPageIdx] = { ...nextPages[rightPageIdx], slots: clonedRight, elements: clonedRight };
    }

    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 清空指定单页上的所有照片 (写入 pages)
  const handleClearPagePhotos = (pageSide: 'left' | 'right') => {
    const pageIdx = currentSpreadIndex * 2 + (pageSide === 'left' ? 0 : 1);
    if (pageIdx >= pages.length) return;
    const pageId = pages[pageIdx].id;

    const nextPages = updateSlotsInPage(pages, pageId, (slots) =>
      slots.map((sl) => ({ ...sl, photoId: undefined, assetId: undefined, crop: undefined }))
    );

    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 应用背景颜色 (写入 pages)
  const handleApplyBackgroundColor = (
    color: string,
    targetPageSide: 'left' | 'right' | 'both'
  ) => {
    const leftPageIdx = currentSpreadIndex * 2;
    const rightPageIdx = currentSpreadIndex * 2 + 1;

    const nextPages = pages.map((page, idx) => {
      if (idx === leftPageIdx && (targetPageSide === 'left' || targetPageSide === 'both')) {
        return { ...page, backgroundColor: color };
      }
      if (idx === rightPageIdx && (targetPageSide === 'right' || targetPageSide === 'both')) {
        return { ...page, backgroundColor: color };
      }
      return page;
    });

    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 一键智能排版：将托盘中未用照片自动填充到画册的空白框中 (写入 pages)
  const handleAutoLayout = () => {
    const unusedPhotos = photos.filter((p) => p.usedCount === 0);
    const photoQueue = [...unusedPhotos, ...photos];
    let photoIdx = 0;

    const nextPages = pages.map((page) => {
      const rawSlots = page.slots || page.elements || [];
      const updatedSlots = rawSlots.map((slot) => {
        if (slot.type === 'photo' && !slot.photoId && photoQueue.length > 0) {
          const chosen = photoQueue[photoIdx % photoQueue.length];
          photoIdx++;
          return {
            ...slot,
            photoId: chosen.id,
            assetId: chosen.id,
            crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
          };
        }
        return slot;
      });

      return {
        ...page,
        slots: updatedSlots,
        elements: updatedSlots,
      };
    });

    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 一键清空作品中的所有照片 (写入 pages)
  const handleClearAll = () => {
    const nextPages = pages.map((page) => {
      const rawSlots = page.slots || page.elements || [];
      const updated = rawSlots.map((s) => ({
        ...s,
        photoId: undefined,
        assetId: undefined,
        crop: undefined,
      }));
      return {
        ...page,
        slots: updated,
        elements: updated,
      };
    });

    setPages(nextPages);
    pushHistory(nextPages);
  };

  // 新增跨页 (支持任意位置插入，使用 reindexPagesForSpreads 保证 pages 唯一真实数据源)
  const handleAddSpread = (insertAfterIndex?: number) => {
    const insertSpreadIdx =
      insertAfterIndex !== undefined ? insertAfterIndex + 1 : Math.floor(pages.length / 2);
    const insertPageIdx = insertSpreadIdx * 2;

    const newLeftPage: PageModel = {
      id: `p_left_${Date.now()}`,
      pageNumber: 0,
      faceType: 'inside_left',
      isLeft: true,
      backgroundColor: '#FFFFFF',
      slots: [
        normalizeSlot({
          id: `slot_left_${Date.now()}`,
          type: 'photo',
          x: 8,
          y: 8,
          width: 84,
          height: 84,
          pixelLabel: '1700x1700',
          placeholderText: '拖入图片',
        }, bookSpec.widthMm, bookSpec.heightMm),
      ],
    };

    const newRightPage: PageModel = {
      id: `p_right_${Date.now()}`,
      pageNumber: 0,
      faceType: 'inside_right',
      isLeft: false,
      backgroundColor: '#FFFFFF',
      slots: [
        normalizeSlot({
          id: `slot_right_${Date.now()}_1`,
          type: 'photo',
          x: 8,
          y: 10,
          width: 40,
          height: 80,
          pixelLabel: '850x1620',
          placeholderText: '拖入图片',
        }, bookSpec.widthMm, bookSpec.heightMm),
        normalizeSlot({
          id: `slot_right_${Date.now()}_2`,
          type: 'photo',
          x: 52,
          y: 10,
          width: 40,
          height: 80,
          pixelLabel: '850x1620',
          placeholderText: '拖入图片',
        }, bookSpec.widthMm, bookSpec.heightMm),
      ],
    };

    const nextPages = [...pages];
    nextPages.splice(insertPageIdx, 0, newLeftPage, newRightPage);
    const reindexed = reindexPagesForSpreads(nextPages);

    setPages(reindexed);
    pushHistory(reindexed);
    setCurrentSpreadIndex(insertSpreadIdx);
  };

  // 删除跨页 (删除后全局自动重排连续页码与 faceType)
  const handleDeleteSpread = (spreadIndex: number) => {
    if (pages.length <= 4) return; // 至少保留封面 + 1 组内页跨页
    const pageIdx = spreadIndex * 2;
    const nextPages = [...pages];
    nextPages.splice(pageIdx, 2);
    const reindexed = reindexPagesForSpreads(nextPages);

    setPages(reindexed);
    pushHistory(reindexed);
    setCurrentSpreadIndex(Math.min(currentSpreadIndex, Math.floor(reindexed.length / 2) - 1));
  };

  // 复制跨页 (复制后全局自动重排连续页码与 faceType)
  const handleDuplicateSpread = (spreadIndex: number) => {
    const pageIdx = spreadIndex * 2;
    const rawLeft = pages[pageIdx];
    const rawRight = pages[pageIdx + 1];
    if (!rawLeft || !rawRight) return;

    const dupLeft: PageModel = {
      ...rawLeft,
      id: `p_left_${Date.now()}`,
      slots: (rawLeft.slots || []).map((s) => ({
        ...s,
        id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      })),
    };
    const dupRight: PageModel = {
      ...rawRight,
      id: `p_right_${Date.now()}`,
      slots: (rawRight.slots || []).map((s) => ({
        ...s,
        id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      })),
    };

    const nextPages = [...pages];
    nextPages.splice(pageIdx + 2, 0, dupLeft, dupRight);
    const reindexed = reindexPagesForSpreads(nextPages);

    setPages(reindexed);
    pushHistory(reindexed);
    setCurrentSpreadIndex(spreadIndex + 1);
  };

  // 跨页拖拽重排 (重排后全局自动重排连续页码与 faceType)
  const handleReorderSpreads = (fromIndex: number, toIndex: number) => {
    const totalSpreads = Math.floor(pages.length / 2);
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= totalSpreads || toIndex >= totalSpreads) {
      return;
    }
    const fromPageIdx = fromIndex * 2;
    const toPageIdx = toIndex * 2;

    const nextPages = [...pages];
    const [pLeft, pRight] = nextPages.splice(fromPageIdx, 2);
    nextPages.splice(toPageIdx, 0, pLeft, pRight);
    const reindexed = reindexPagesForSpreads(nextPages);

    setPages(reindexed);
    pushHistory(reindexed);
    setCurrentSpreadIndex(toIndex);
  };

  const currentSpread = spreads[currentSpreadIndex] || spreads[0];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#ededf0] text-neutral-800 overflow-hidden font-sans antialiased">
      {/* 顶部白色主导航工具栏 */}
      <Header
        bookSpec={bookSpec}
        onSelectSpec={(spec) => setBookSpec(spec)}
        projectName={projectName}
        onUpdateProjectName={setProjectName}
        viewConfig={viewConfig}
        onUpdateViewConfig={(cfg) => setViewConfig((prev) => ({ ...prev, ...cfg }))}
        spacingConfig={spacingConfig}
        onUpdateSpacingConfig={(cfg) => setSpacingConfig((prev) => ({ ...prev, ...cfg }))}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenPreview={() => setIsPreviewOpen(true)}
        onOpenPrintExport={() => setIsPrintExportOpen(true)}
        onOpenMultiPage={() => setIsMultiPageOpen(true)}
        onAddImageSlot={handleAddImageSlot}
        onAddTextSlot={handleAddTextSlot}
        totalPageCount={pages.length}
        hasSelectedSlots={selectedSlotIds.length > 0 || !!selectedSlotId}
        onLayerOrder={handleLayerOrder}
        onAutoFit={handleAutoFitToScreen}
        onSaveProject={handleSaveProject}
        onAddToCart={handleAddToCart}
        onOpenProjectManager={() => setIsProjectManagerOpen(true)}
        autoSaveStatus={saveStatus}
        estimatedPrice={currentPriceBreakdown.total}
        currencySymbol="￥"
        userRoleLabel={currentPriceBreakdown.tierDescription}
      />

      {/* 主体工作区 (最左侧窄栏导航 + 二级抽屉面板 + 中央双页展开画板) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 最左侧一级深灰导航栏 */}
        <SidebarNav
          activeTab={activeSidebarTab}
          onSelectTab={(tab) => {
            if (activeSidebarTab === tab && !isSidebarCollapsed) {
              setIsSidebarCollapsed(true);
            } else {
              setActiveSidebarTab(tab);
              setIsSidebarCollapsed(false);
            }
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* 二级面板抽屉 (照片/版式/背景/素材) */}
        {!isSidebarCollapsed && (
          <PhotoTray
            activeTab={activeSidebarTab}
            photos={photos}
            onAddPhotos={handleAddPhotos}
            onRemovePhoto={handleRemovePhoto}
            selectedSlotId={selectedSlotId}
            activeSide={activeSide}
            onSelectSide={setActiveSide}
            onFillActiveSlot={handleFillActiveSlot}
            onApplyLayoutToCurrentPage={handleApplyLayoutToCurrentPage}
            onApplySpreadLayout={handleApplySpreadLayout}
            onApplyBackgroundColor={handleApplyBackgroundColor}
            onApplyMask={handleApplyMask}
            onAddStamp={handleAddStamp}
            currentPageNumber={{
              left: currentSpread.leftPage.pageNumber,
              right: currentSpread.rightPage.pageNumber,
            }}
            currentLeftSlots={currentSpread.leftPage.slots}
            currentRightSlots={currentSpread.rightPage.slots}
          />
        )}

        {/* 中央双页画板区域 */}
        <SpreadCanvas
          spread={currentSpread}
          spreads={spreads}
          currentSpreadIndex={currentSpreadIndex}
          onSelectSpread={setCurrentSpreadIndex}
          onOpenMultiPage={() => setIsMultiPageOpen(true)}
          bookSpec={bookSpec}
          viewConfig={viewConfig}
          onUpdateViewConfig={(cfg) => setViewConfig((prev) => ({ ...prev, ...cfg }))}
          spacingConfig={spacingConfig}
          photos={photos}
          selectedSlotId={selectedSlotId}
          selectedSlotIds={selectedSlotIds}
          activeSide={activeSide}
          onSelectSide={setActiveSide}
          onSelectSlot={handleSelectSlot}
          onSelectMultipleSlots={handleSelectMultipleSlots}
          onDropPhotoToSlot={handleDropPhotoToSlot}
          onUpdateSlotCrop={handleUpdateSlotCrop}
          onClearSlotPhoto={handleClearSlotPhoto}
          onUpdateSlotProps={handleUpdateSlotProps}
          onBringForward={() => handleLayerOrder('bringForward')}
          onSendBackward={() => handleLayerOrder('sendBackward')}
          onBringToFront={() => handleLayerOrder('bringToFront')}
          onSendToBack={() => handleLayerOrder('sendToBack')}
          onMakeFullScreen={handleMakeFullScreen}
          onLocatePhoto={handleLocatePhoto}
          onUpdateSlotText={handleUpdateSlotText}
          onUpdateSlotBounds={handleUpdateSlotBounds}
          onUpdateMultipleSlotsBounds={handleUpdateMultipleSlotsBounds}
          onCommitSlotBounds={handleCommitSlotBounds}
          onDeleteSlot={handleDeleteSlot}
          onDeleteMultipleSlots={handleDeleteMultipleSlotsAcrossPages}
          onDuplicateSlot={handleDuplicateSlot}
          onSwapPhotos={handleSwapSlotsPhotos}
          onSwapSpreadPagePhotos={handleSwapSpreadPagePhotos}
          onOpenLayoutDrawer={(page) => {
            setActiveSide(page);
            setActiveSidebarTab('layouts');
            setIsSidebarCollapsed(false);
          }}
          onClearPagePhotos={handleClearPagePhotos}
          onAddStampAtPosition={handleAddStampAtPosition}
        />

        {/* 最右侧页面管理大纲栏 (1:1 整合原底部全部功能 + 纵向单双列页面列表) */}
        <RightPagesSidebar
          spreads={spreads}
          currentSpreadIndex={currentSpreadIndex}
          onSelectSpread={setCurrentSpreadIndex}
          onAddSpread={handleAddSpread}
          onDeleteSpread={handleDeleteSpread}
          onAutoLayout={handleAutoLayout}
          onClearAll={handleClearAll}
          onSwapSpreadPagePhotos={handleSwapSpreadPagePhotos}
          onOpenMultiPage={() => setIsMultiPageOpen(true)}
          photos={photos}
          bookSpec={bookSpec}
          isCollapsed={isRightSidebarCollapsed}
          onToggleCollapse={() => setIsRightSidebarCollapsed(!isRightSidebarCollapsed)}
        />
      </div>

      {/* 多页全书编辑与平铺总览模态框 (1:1 复刻图邦主风格) */}
      <MultiPageEditorModal
        isOpen={isMultiPageOpen}
        onClose={() => setIsMultiPageOpen(false)}
        spreads={spreads}
        currentSpreadIndex={currentSpreadIndex}
        onSelectSpread={setCurrentSpreadIndex}
        onAddSpread={handleAddSpread}
        onDeleteSpread={handleDeleteSpread}
        onDuplicateSpread={handleDuplicateSpread}
        onReorderSpreads={handleReorderSpreads}
        onSwapSpreadPagePhotos={handleSwapSpreadPagePhotos}
        onAutoLayout={handleAutoLayout}
        onClearAll={handleClearAll}
        photos={photos}
        bookSpec={bookSpec}
      />

      {/* 全屏仿真翻页预览模态框 */}
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        spreads={spreads}
        photos={photos}
        bookSpec={bookSpec}
      />

      {/* 印刷级 300 DPI 高清 JPG 导出与质检模态框 */}
      <PrintExportModal
        isOpen={isPrintExportOpen}
        onClose={() => setIsPrintExportOpen(false)}
        spreads={spreads}
        bookSpec={bookSpec}
        photos={photos}
        projectName={projectName}
      />

      {/* 多作品管理中心模态框 (支持代理商多工程管理、快速复制、重命名、价格计算) */}
      <ProjectManagerModal
        isOpen={isProjectManagerOpen}
        currentProjectId={currentProjectId}
        onClose={() => setIsProjectManagerOpen(false)}
        onSelectProject={handleSelectProject}
        onToast={showToast}
      />

      {/* 全局 SVG 遮罩定义 */}
      <MomoGlobalClipPaths />

      {/* 全局操作 Toast 提示 */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[200] bg-neutral-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur-xs flex items-center space-x-2 animate-fade-in border border-white/10 pointer-events-none">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
