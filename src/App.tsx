import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { SidebarNav } from './components/SidebarNav';
import { PhotoTray } from './components/PhotoTray';
import { SpreadCanvas } from './components/SpreadCanvas';
import { RightPagesSidebar } from './components/RightPagesSidebar';
import { PreviewModal } from './components/PreviewModal';
import { PrintExportModal } from './components/PrintExportModal';
import { MultiPageEditorModal } from './components/MultiPageEditorModal';
import {
  DEFAULT_BOOK_SPEC,
  createInitialSpreads,
  SAMPLE_PHOTOS,
} from './data/defaultTemplates';
import {
  SpreadModel,
  UploadedPhoto,
  EditorViewConfig,
  PhotoCrop,
  BookSpec,
  ProductSpec,
  SidebarTab,
  FrameSlot,
  SpacingConfig,
  ProjectDocument,
  CURRENT_SCHEMA_VERSION,
} from './types/editor';
import {
  createImmutableOrderSnapshot,
  migrateProjectDocument,
  normalizeSlot,
} from './utils/projectSerializer';

export default function App() {
  const [bookSpec, setBookSpec] = useState<BookSpec>(DEFAULT_BOOK_SPEC);
  const [projectName, setProjectName] = useState<string>('我的照片书');
  const [spreads, setSpreads] = useState<SpreadModel[]>(() => {
    return createInitialSpreads().map((s) => ({
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
    }));
  });
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

  // 商业化草稿保存与快照处理 (自动补齐物理毫米坐标与标准 Schema)
  const handleSaveProject = useCallback(() => {
    const rawDoc = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: `proj_${Date.now()}`,
      title: projectName,
      productSpec: bookSpec,
      spreads,
      photos,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const doc = migrateProjectDocument(rawDoc);
    try {
      localStorage.setItem('photobook_current_draft', JSON.stringify(doc));
    } catch (e) {
      console.warn('Draft local cache note:', e);
    }
  }, [projectName, bookSpec, spreads, photos]);

  // 商业化加入购物车/下单：生成不可篡改的订单快照
  const handleAddToCart = useCallback(() => {
    const rawDoc = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: `proj_${Date.now()}`,
      title: projectName,
      productSpec: bookSpec,
      spreads,
      photos,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const doc = migrateProjectDocument(rawDoc);
    const orderSnapshot = createImmutableOrderSnapshot({
      project: doc,
      quantity: 1,
      unitPrice: 99.0,
      currency: 'CNY',
    });
    try {
      localStorage.setItem(`order_snapshot_${orderSnapshot.snapshotId}`, JSON.stringify(orderSnapshot));
    } catch (e) {
      console.warn('Order snapshot cache note:', e);
    }
  }, [projectName, bookSpec, spreads, photos]);

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

  // 撤销 / 重做 历史栈
  const [history, setHistory] = useState<SpreadModel[][]>([createInitialSpreads()]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // 全局轻量 Toast 提示
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 智能计算并自动贴合屏幕的最佳缩放比例 (Auto-Fit Zoom)
  const handleAutoFitToScreen = useCallback(() => {
    // 默认保持 100% 居中标准比例
    setViewConfig((prev) => ({ ...prev, zoomPercent: 100 }));
  }, []);

  // 初次加载与侧边栏折叠/展开时保持默认 100% 居中视口
  useEffect(() => {
    // 默认保持 100% 居中
  }, []);

  // 记录历史快照
  const pushHistory = useCallback(
    (newSpreads: SpreadModel[]) => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, newSpreads];
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
      setSpreads(history[nextIdx]);
    }
  }, [historyIndex, history]);

  // 重做
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setSpreads(history[nextIdx]);
    }
  }, [historyIndex, history]);

  // 动态同步计算每张照片在画册中的 usedCount
  useEffect(() => {
    const counts = new Map<string, number>();
    spreads.forEach((spread) => {
      spread.leftPage.slots.forEach((s) => {
        if (s.photoId) counts.set(s.photoId, (counts.get(s.photoId) || 0) + 1);
      });
      spread.rightPage.slots.forEach((s) => {
        if (s.photoId) counts.set(s.photoId, (counts.get(s.photoId) || 0) + 1);
      });
    });

    setPhotos((prev) =>
      prev.map((p) => ({
        ...p,
        usedCount: counts.get(p.id) || 0,
      }))
    );
  }, [spreads]);

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

  // 互换两个画框的照片 (支持同一页或跨左/右页，保持各自画框网格不变)
  const handleSwapSlotsPhotos = useCallback((slotIdA: string, slotIdB: string) => {
    const currentSpread = spreads[currentSpreadIndex];
    if (!currentSpread) return;

    let slotA: FrameSlot | undefined;
    let slotB: FrameSlot | undefined;
    let pageAId: string | undefined;
    let pageBId: string | undefined;

    // 寻找 Slot A
    if (currentSpread.leftPage.slots.some((s) => s.id === slotIdA)) {
      slotA = currentSpread.leftPage.slots.find((s) => s.id === slotIdA);
      pageAId = currentSpread.leftPage.id;
    } else if (currentSpread.rightPage.slots.some((s) => s.id === slotIdA)) {
      slotA = currentSpread.rightPage.slots.find((s) => s.id === slotIdA);
      pageBId = currentSpread.rightPage.id;
      pageAId = currentSpread.rightPage.id;
    }

    // 寻找 Slot B
    if (currentSpread.leftPage.slots.some((s) => s.id === slotIdB)) {
      slotB = currentSpread.leftPage.slots.find((s) => s.id === slotIdB);
      pageBId = currentSpread.leftPage.id;
    } else if (currentSpread.rightPage.slots.some((s) => s.id === slotIdB)) {
      slotB = currentSpread.rightPage.slots.find((s) => s.id === slotIdB);
      pageBId = currentSpread.rightPage.id;
    }

    if (!slotA || !slotB) return;

    const photoIdA = slotA.photoId;
    const photoIdB = slotB.photoId;

    // 更新当前 Spread
    const nextSpreads = spreads.map((spread, idx) => {
      if (idx !== currentSpreadIndex) return spread;

      const updateSlots = (slots: FrameSlot[]) =>
        slots.map((s) => {
          if (s.id === slotIdA) {
            return {
              ...s,
              photoId: photoIdB,
              crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
            };
          }
          if (s.id === slotIdB) {
            return {
              ...s,
              photoId: photoIdA,
              crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
            };
          }
          return s;
        });

      return {
        ...spread,
        leftPage: {
          ...spread.leftPage,
          slots: updateSlots(spread.leftPage.slots),
        },
        rightPage: {
          ...spread.rightPage,
          slots: updateSlots(spread.rightPage.slots),
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
    setSelectedSlotId(slotIdB);
    setSelectedSlotIds([slotIdB]);
    setToastMessage('已互换两张照片（画框位置与尺寸保持不变）');
    setTimeout(() => setToastMessage(null), 2500);
  }, [spreads, currentSpreadIndex, pushHistory]);

  // 跨页左右版面互换 (方案 A：整页版式结构、画框布局与照片整体对调)
  const handleSwapSpreadPagePhotos = useCallback((targetSpreadIndex?: number) => {
    const spreadIdx = targetSpreadIndex !== undefined ? targetSpreadIndex : currentSpreadIndex;
    const targetSpread = spreads[spreadIdx];
    if (!targetSpread) return;

    const nextSpreads = spreads.map((spread, idx) => {
      if (idx !== spreadIdx) return spread;

      // 获取左页与右页的原版内容
      const leftSlots = spread.leftPage.slots;
      const rightSlots = spread.rightPage.slots;
      const leftBg = spread.leftPage.backgroundColor;
      const rightBg = spread.rightPage.backgroundColor;
      const leftBgImg = spread.leftPage.backgroundImage;
      const rightBgImg = spread.rightPage.backgroundImage;
      const leftLayoutId = spread.leftPage.layoutId;
      const rightLayoutId = spread.rightPage.layoutId;

      return {
        ...spread,
        leftPage: {
          ...spread.leftPage,
          slots: rightSlots,
          backgroundColor: rightBg,
          backgroundImage: rightBgImg,
          layoutId: rightLayoutId,
        },
        rightPage: {
          ...spread.rightPage,
          slots: leftSlots,
          backgroundColor: leftBg,
          backgroundImage: leftBgImg,
          layoutId: leftLayoutId,
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  }, [spreads, currentSpreadIndex, pushHistory]);

  // 批量删除多个选中的画框
  const handleDeleteMultipleSlotsAcrossPages = useCallback((slotIds: string[]) => {
    if (!slotIds || slotIds.length === 0) return;
    const deleteSet = new Set(slotIds);

    const nextSpreads = spreads.map((spread) => ({
      ...spread,
      leftPage: {
        ...spread.leftPage,
        slots: spread.leftPage.slots.filter((s) => !deleteSet.has(s.id)),
      },
      rightPage: {
        ...spread.rightPage,
        slots: spread.rightPage.slots.filter((s) => !deleteSet.has(s.id)),
      },
    }));

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
    setSelectedSlotId(null);
    setSelectedSlotIds([]);
  }, [spreads, pushHistory]);

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

  // 粘贴画框 (Ctrl + V)，支持同页递增微量偏移 (+3%) 与跨页精准粘贴
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

    const nextSpreads = spreads.map((s, idx) => {
      if (idx !== currentSpreadIndex) return s;
      const isLeft = targetSide === 'left';
      const targetPage = isLeft ? s.leftPage : s.rightPage;
      return {
        ...s,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: [...targetPage.slots, ...newSlots],
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);

    // 自动高亮选中新粘贴生成的画框
    setSelectedSlotIds(newSlotIds);
    setSelectedSlotId(newSlotIds[newSlotIds.length - 1]);
    setActiveSide(targetSide);
    setPasteCount((prev) => prev + 1);
  }, [slotClipboard, spreads, currentSpreadIndex, activeSide, pasteCount, pushHistory]);

  // 快速就地原样克隆选中画框 (Ctrl + D)
  const handleDuplicateSelection = useCallback(() => {
    const activeIds = selectedSlotIds.length > 0 ? selectedSlotIds : selectedSlotId ? [selectedSlotId] : [];
    if (activeIds.length === 0) return;

    handleCopySlots();
    // 延迟一个渲染周期待剪贴板更新后立即粘贴
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
        // 从倒数第二个往前遍历，若当前元素被选中且下一个未被选中，则互换
        for (let i = newSlots.length - 2; i >= 0; i--) {
          if (selectedSet.has(newSlots[i].id) && !selectedSet.has(newSlots[i + 1].id)) {
            const temp = newSlots[i];
            newSlots[i] = newSlots[i + 1];
            newSlots[i + 1] = temp;
          }
        }
      } else if (action === 'sendBackward') {
        // 从第二个往后遍历，若当前元素被选中且前一个未被选中，则互换
        for (let i = 1; i < newSlots.length; i++) {
          if (selectedSet.has(newSlots[i].id) && !selectedSet.has(newSlots[i - 1].id)) {
            const temp = newSlots[i];
            newSlots[i] = newSlots[i - 1];
            newSlots[i - 1] = temp;
          }
        }
      } else if (action === 'bringToFront') {
        // 将选中的元素整体移至末尾（最顶层），保留相对先后次序
        const unselected = newSlots.filter((s) => !selectedSet.has(s.id));
        const selected = newSlots.filter((s) => selectedSet.has(s.id));
        newSlots = [...unselected, ...selected];
      } else if (action === 'sendToBack') {
        // 将选中的元素整体移至开头（最底层），保留相对先后次序
        const unselected = newSlots.filter((s) => !selectedSet.has(s.id));
        const selected = newSlots.filter((s) => selectedSet.has(s.id));
        newSlots = [...selected, ...unselected];
      }

      return newSlots.map((s, idx) => ({ ...s, zIndex: idx + 1 }));
    };

    let hasChanged = false;
    const nextSpreads = spreads.map((spread, idx) => {
      if (idx !== currentSpreadIndex) return spread;

      const nextLeftSlots = reorderSlots(spread.leftPage.slots);
      const nextRightSlots = reorderSlots(spread.rightPage.slots);

      const leftChanged = nextLeftSlots.some((s, i) => s.id !== spread.leftPage.slots[i]?.id);
      const rightChanged = nextRightSlots.some((s, i) => s.id !== spread.rightPage.slots[i]?.id);

      if (leftChanged || rightChanged) {
        hasChanged = true;
      }

      return {
        ...spread,
        leftPage: { ...spread.leftPage, slots: nextLeftSlots },
        rightPage: { ...spread.rightPage, slots: nextRightSlots },
      };
    });

    if (hasChanged) {
      setSpreads(nextSpreads);
      pushHistory(nextSpreads);
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
  }, [selectedSlotIds, selectedSlotId, spreads, currentSpreadIndex, pushHistory]);

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

  // 从托盘删除照片
  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    // 清除页面中对此照片的引用
    const nextSpreads = spreads.map((spread) => ({
      ...spread,
      leftPage: {
        ...spread.leftPage,
        slots: spread.leftPage.slots.map((s) =>
          s.photoId === photoId ? { ...s, photoId: undefined, crop: undefined } : s
        ),
      },
      rightPage: {
        ...spread.rightPage,
        slots: spread.rightPage.slots.map((s) =>
          s.photoId === photoId ? { ...s, photoId: undefined, crop: undefined } : s
        ),
      },
    }));
    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 将照片放入指定槽位
  const handleDropPhotoToSlot = (pageId: string, slotId: string, photoId: string) => {
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const updatedSlots = targetPage.slots.map((s) => {
        if (s.id === slotId) {
          return {
            ...s,
            photoId,
            crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
          };
        }
        return s;
      });

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: updatedSlots,
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
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

  // 执行替换照片 (严格遵循只换照片不换画框原则)
  const handleSwapSlotPhoto = useCallback((pageId: string, slotId: string, newPhotoId: string) => {
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const updatedSlots = targetPage.slots.map((s) => {
        if (s.id === slotId) {
          // 核心：只替换 photoId (assetId) 与重置为安全 cover crop，画框 ID/坐标/尺寸/旋转/层级等 100% 保持不变
          return {
            ...s,
            photoId: newPhotoId,
            crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
          };
        }
        return s;
      });

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: updatedSlots,
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
    setSelectedSlotId(slotId);
    setSelectedSlotIds([slotId]);

    const targetPhoto = photos.find((p) => p.id === newPhotoId);
    if (targetPhoto) {
      setToastMessage(`已更换为「${targetPhoto.name}」（画框保持不变）`);
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [spreads, photos, pushHistory]);

  // 更新槽位裁剪/缩放参数
  const handleUpdateSlotCrop = (pageId: string, slotId: string, crop: PhotoCrop) => {
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const updatedSlots = targetPage.slots.map((s) => (s.id === slotId ? { ...s, crop } : s));

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: updatedSlots,
        },
      };
    });

    setSpreads(nextSpreads);
  };

  // 更新画框在页面上的坐标与尺寸 (DIY 自由排版，严格同步物理毫米真值)
  const handleUpdateSlotBounds = (
    pageId: string,
    slotId: string,
    bounds: { x: number; y: number; width: number; height: number; rotation?: number }
  ) => {
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const updatedSlots = targetPage.slots.map((s) => {
        if (s.id !== slotId) return s;
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

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: updatedSlots,
        },
      };
    });

    setSpreads(nextSpreads);
  };

  // 批量更新多个槽位的位置 (多选批量平移，严格同步物理毫米真值)
  const handleUpdateMultipleSlotsBounds = (
    pageId: string,
    updates: { slotId: string; bounds: { x: number; y: number; width: number; height: number; rotation?: number } }[]
  ) => {
    const updateMap = new Map(updates.map((u) => [u.slotId, u.bounds]));
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const updatedSlots = targetPage.slots.map((s) => {
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
      });

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: updatedSlots,
        },
      };
    });

    setSpreads(nextSpreads);
  };

  // 提交画框位置变动到历史
  const handleCommitSlotBounds = () => {
    pushHistory(spreads);
  };

  // 删除画框
  const handleDeleteSlot = (pageId: string, slotId: string) => {
    handleDeleteMultipleSlotsAcrossPages([slotId]);
  };

  // 复制画框
  const handleDuplicateSlot = (pageId: string, slotId: string) => {
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const slotToClone = targetPage.slots.find((s) => s.id === slotId);
      if (!slotToClone) return spread;

      const clonedSlot: FrameSlot = normalizeSlot({
        ...slotToClone,
        id: `slot_dup_${Date.now()}`,
        x: Math.min(85, slotToClone.x + 4),
        y: Math.min(85, slotToClone.y + 4),
      }, bookSpec.widthMm, bookSpec.heightMm);

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: [...targetPage.slots, clonedSlot],
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 清除槽位照片
  const handleClearSlotPhoto = (pageId: string, slotId: string) => {
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const updatedSlots = targetPage.slots.map((s) =>
        s.id === slotId ? { ...s, photoId: undefined, crop: undefined } : s
      );

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: updatedSlots,
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 更新画框扩展属性 (遮罩、描边、圆角、不透明度、投影、适应模式、水平翻转等)
  const handleUpdateSlotProps = (pageId: string, slotId: string, newProps: Partial<FrameSlot>) => {
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const updatedSlots = targetPage.slots.map((s) => {
        if (s.id !== slotId) return s;
        return {
          ...s,
          ...newProps,
        };
      });

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: updatedSlots,
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 画框一键满屏 (占满整页 100% 宽高)
  const handleMakeFullScreen = (pageId: string, slotId: string) => {
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const updatedSlots = targetPage.slots.map((s) => {
        if (s.id !== slotId) return s;
        return normalizeSlot(
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
        );
      });

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: updatedSlots,
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
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

  // 更新文本框内容
  const handleUpdateSlotText = (pageId: string, slotId: string, text: string) => {
    const nextSpreads = spreads.map((spread) => {
      const isLeft = spread.leftPage.id === pageId;
      const isRight = spread.rightPage.id === pageId;

      if (!isLeft && !isRight) return spread;

      const targetPage = isLeft ? spread.leftPage : spread.rightPage;
      const updatedSlots = targetPage.slots.map((s) => (s.id === slotId ? { ...s, text } : s));

      return {
        ...spread,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...targetPage,
          slots: updatedSlots,
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 插入自定义图片框 (智能推断当前选中的画框所在页，或当前激活的页面：左页或右页)
  const handleAddImageSlot = () => {
    const currentSpread = spreads[currentSpreadIndex];
    let targetSide: 'left' | 'right' = activeSide || 'left';

    // 优先 1：如果当前有选中的画框，直接检查该画框属于左页还是右页
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

    const nextSpreads = spreads.map((s, idx) => {
      if (idx !== currentSpreadIndex) return s;
      const isLeft = targetSide === 'left';
      return {
        ...s,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...s[isLeft ? 'leftPage' : 'rightPage'],
          slots: [...s[isLeft ? 'leftPage' : 'rightPage'].slots, newSlot],
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
    setSelectedSlotId(newSlot.id);
    setSelectedSlotIds([newSlot.id]);
    setActiveSide(targetSide);
  };

  // 插入自定义文字框 (智能推断当前选中的画框所在页，或当前激活的页面：左页或右页)
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

    const nextSpreads = spreads.map((s, idx) => {
      if (idx !== currentSpreadIndex) return s;
      const isLeft = targetSide === 'left';
      return {
        ...s,
        [isLeft ? 'leftPage' : 'rightPage']: {
          ...s[isLeft ? 'leftPage' : 'rightPage'],
          slots: [...s[isLeft ? 'leftPage' : 'rightPage'].slots, newSlot],
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
    setSelectedSlotId(newSlot.id);
    setSelectedSlotIds([newSlot.id]);
    setActiveSide(targetSide);
  };

  // 应用单页版式到当前页 (左页/右页)
  const handleApplyLayoutToCurrentPage = (
    slots: FrameSlot[],
    targetPage: 'left' | 'right' | 'both'
  ) => {
    const clonedSlots = slots.map((s, i) =>
      normalizeSlot({
        ...s,
        id: `slot_${Date.now()}_${i}`,
      }, bookSpec.widthMm, bookSpec.heightMm)
    );

    const nextSpreads = spreads.map((s, idx) => {
      if (idx !== currentSpreadIndex) return s;

      let nextLeft = s.leftPage;
      let nextRight = s.rightPage;

      if (targetPage === 'left' || targetPage === 'both') {
        nextLeft = { ...nextLeft, slots: clonedSlots };
      }
      if (targetPage === 'right' || targetPage === 'both') {
        nextRight = {
          ...nextRight,
          slots: slots.map((sl, i) =>
            normalizeSlot({ ...sl, id: `slot_r_${Date.now()}_${i}` }, bookSpec.widthMm, bookSpec.heightMm)
          ),
        };
      }

      return {
        ...s,
        leftPage: nextLeft,
        rightPage: nextRight,
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 应用跨页连通大片版式
  const handleApplySpreadLayout = (leftSlots: FrameSlot[], rightSlots: FrameSlot[]) => {
    const clonedLeft = leftSlots.map((s, i) =>
      normalizeSlot({
        ...s,
        id: `slot_sp_l_${Date.now()}_${i}`,
      }, bookSpec.widthMm, bookSpec.heightMm)
    );
    const clonedRight = rightSlots.map((s, i) =>
      normalizeSlot({
        ...s,
        id: `slot_sp_r_${Date.now()}_${i}`,
      }, bookSpec.widthMm, bookSpec.heightMm)
    );

    const nextSpreads = spreads.map((s, idx) => {
      if (idx !== currentSpreadIndex) return s;
      return {
        ...s,
        leftPage: { ...s.leftPage, slots: clonedLeft },
        rightPage: { ...s.rightPage, slots: clonedRight },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 清空指定单页上的所有照片
  const handleClearPagePhotos = (page: 'left' | 'right') => {
    const nextSpreads = spreads.map((s, idx) => {
      if (idx !== currentSpreadIndex) return s;
      if (page === 'left') {
        return {
          ...s,
          leftPage: {
            ...s.leftPage,
            slots: s.leftPage.slots.map((sl) => ({ ...sl, photoId: undefined, crop: undefined })),
          },
        };
      } else {
        return {
          ...s,
          rightPage: {
            ...s.rightPage,
            slots: s.rightPage.slots.map((sl) => ({ ...sl, photoId: undefined, crop: undefined })),
          },
        };
      }
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 应用背景颜色
  const handleApplyBackgroundColor = (
    color: string,
    targetPage: 'left' | 'right' | 'both'
  ) => {
    const nextSpreads = spreads.map((s, idx) => {
      if (idx !== currentSpreadIndex) return s;
      return {
        ...s,
        leftPage: {
          ...s.leftPage,
          backgroundColor:
            targetPage === 'left' || targetPage === 'both' ? color : s.leftPage.backgroundColor,
        },
        rightPage: {
          ...s.rightPage,
          backgroundColor:
            targetPage === 'right' || targetPage === 'both' ? color : s.rightPage.backgroundColor,
        },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 一键智能排版：将托盘中未用照片自动填充到画册的空白框中
  const handleAutoLayout = () => {
    const unusedPhotos = photos.filter((p) => p.usedCount === 0);
    const photoQueue = [...unusedPhotos, ...photos]; // 如果不够则循环使用
    let photoIdx = 0;

    const nextSpreads = spreads.map((spread) => {
      const fillSlots = (slots: FrameSlot[]) =>
        slots.map((slot) => {
          if (slot.type === 'photo' && !slot.photoId && photoQueue.length > 0) {
            const chosen = photoQueue[photoIdx % photoQueue.length];
            photoIdx++;
            return {
              ...slot,
              photoId: chosen.id,
              crop: { x: 50, y: 50, scale: 1.0, rotation: 0 },
            };
          }
          return slot;
        });

      return {
        ...spread,
        leftPage: { ...spread.leftPage, slots: fillSlots(spread.leftPage.slots) },
        rightPage: { ...spread.rightPage, slots: fillSlots(spread.rightPage.slots) },
      };
    });

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 一键清空作品中的所有照片
  const handleClearAll = () => {
    const nextSpreads = spreads.map((spread) => ({
      ...spread,
      leftPage: {
        ...spread.leftPage,
        slots: spread.leftPage.slots.map((s) => ({
          ...s,
          photoId: undefined,
          crop: undefined,
        })),
      },
      rightPage: {
        ...spread.rightPage,
        slots: spread.rightPage.slots.map((s) => ({
          ...s,
          photoId: undefined,
          crop: undefined,
        })),
      },
    }));

    setSpreads(nextSpreads);
    pushHistory(nextSpreads);
  };

  // 规范化并重新计算全书每个跨页的真实页码 (0 封面, 1 扉页, 2-3, 4-5, 6-7, ...)
  const reindexAllSpreads = (spreadList: SpreadModel[]): SpreadModel[] => {
    let currentPageCounter = 0;
    return spreadList.map((s, idx) => {
      const isCover = s.isCover || idx === 0;
      if (isCover) {
        return {
          ...s,
          spreadIndex: idx,
          isCover: true,
          name: '封面',
          leftPage: {
            ...s.leftPage,
            pageNumber: 0,
          },
          rightPage: {
            ...s.rightPage,
            pageNumber: 0,
          },
        };
      }

      if (idx === 1) {
        // 扉页：左侧空白衬纸 (0 / FRONT INSIDE)，右侧第 1 页
        currentPageCounter = 1;
        return {
          ...s,
          spreadIndex: idx,
          name: '第 1 页 (扉页)',
          leftPage: {
            ...s.leftPage,
            pageNumber: 0,
          },
          rightPage: {
            ...s.rightPage,
            pageNumber: 1,
          },
        };
      }

      // 后续常规双跨页：连续递增页码 (2-3, 4-5, 6-7, 8-9, ...)
      const leftPageNum = currentPageCounter + 1;
      const rightPageNum = currentPageCounter + 2;
      currentPageCounter += 2;

      return {
        ...s,
        spreadIndex: idx,
        name: `第 ${leftPageNum}-${rightPageNum} 跨页`,
        leftPage: {
          ...s.leftPage,
          pageNumber: leftPageNum,
        },
        rightPage: {
          ...s.rightPage,
          pageNumber: rightPageNum,
        },
      };
    });
  };

  // 新增跨页 (支持任意位置插入，插入后全局自动重排连续页码)
  const handleAddSpread = (insertAfterIndex?: number) => {
    const insertIdx =
      insertAfterIndex !== undefined ? insertAfterIndex + 1 : spreads.length;

    const newSpread: SpreadModel = {
      id: `spread_${Date.now()}`,
      spreadIndex: insertIdx,
      name: `新跨页`,
      leftPage: {
        id: `p_left_${Date.now()}`,
        pageNumber: 0,
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
      },
      rightPage: {
        id: `p_right_${Date.now()}`,
        pageNumber: 0,
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
      },
    };

    const nextSpreads = [...spreads];
    nextSpreads.splice(insertIdx, 0, newSpread);

    // 全局重新计算并连续编排页码
    const reindexed = reindexAllSpreads(nextSpreads);

    setSpreads(reindexed);
    pushHistory(reindexed);
    setCurrentSpreadIndex(insertIdx);
  };

  // 删除跨页 (删除后全局自动重排连续页码)
  const handleDeleteSpread = (index: number) => {
    if (spreads.length <= 1) return;
    const filtered = spreads.filter((_, i) => i !== index);
    const reindexed = reindexAllSpreads(filtered);

    setSpreads(reindexed);
    pushHistory(reindexed);
    setCurrentSpreadIndex(Math.min(currentSpreadIndex, reindexed.length - 1));
  };

  // 复制跨页 (复制后全局自动重排连续页码)
  const handleDuplicateSpread = (index: number) => {
    const target = spreads[index];
    if (!target) return;
    const duplicated: SpreadModel = {
      ...target,
      id: `spread_${Date.now()}`,
      spreadIndex: index + 1,
      leftPage: {
        ...target.leftPage,
        id: `p_left_${Date.now()}`,
        slots: target.leftPage.slots.map((s) => ({
          ...s,
          id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        })),
      },
      rightPage: {
        ...target.rightPage,
        id: `p_right_${Date.now()}`,
        slots: target.rightPage.slots.map((s) => ({
          ...s,
          id: `slot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        })),
      },
    };

    const nextSpreads = [...spreads];
    nextSpreads.splice(index + 1, 0, duplicated);
    const reindexed = reindexAllSpreads(nextSpreads);

    setSpreads(reindexed);
    pushHistory(reindexed);
    setCurrentSpreadIndex(index + 1);
  };

  // 跨页拖拽重排 (重排后全局自动重排连续页码)
  const handleReorderSpreads = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= spreads.length || toIndex >= spreads.length) {
      return;
    }
    const nextSpreads = [...spreads];
    const [moved] = nextSpreads.splice(fromIndex, 1);
    nextSpreads.splice(toIndex, 0, moved);
    const reindexed = reindexAllSpreads(nextSpreads);

    setSpreads(reindexed);
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
        totalPageCount={bookSpec.defaultPages}
        hasSelectedSlots={selectedSlotIds.length > 0 || !!selectedSlotId}
        onLayerOrder={handleLayerOrder}
        onAutoFit={handleAutoFitToScreen}
        onSaveProject={handleSaveProject}
        onAddToCart={handleAddToCart}
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
        currentSpread={currentSpread}
        bookSpec={bookSpec}
        photos={photos}
        projectName={projectName}
      />

      {/* 全局操作 Toast 提示 */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[200] bg-neutral-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur-xs flex items-center space-x-2 animate-fade-in border border-white/10 pointer-events-none">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
