import { FrameSlot } from '../types/editor';

export interface GuideLine {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number; // 0 - 100 百分比坐标
  color: 'red' | 'yellow'; // red: 边框/外缘/裁切线对齐; yellow: 几何中心对齐
}

export interface SpacingGap {
  id: string;
  x: number; // 百分比坐标
  y: number;
  width: number;
  height: number;
  orientation: 'horizontal' | 'vertical'; // horizontal: 左右间隙; vertical: 上下间隙
  label?: string; // 毫米标签，如 "2.0 mm"
}

export interface FixedGapConfig {
  enabled: boolean;
  gapPercentX: number;
  gapPercentY: number;
  gapMm: number;
}

export interface SnapResult {
  x: number;
  y: number;
  width: number;
  height: number;
  guides: GuideLine[];
  spacingGaps: SpacingGap[];
}

// 基础默认磁吸阈值（百分比），若传入容器物理像素则会动态换算为恒定 7px 物理屏幕灵敏度
const DEFAULT_SNAP_THRESHOLD = 2.2;

interface SnapCandidate {
  targetCoord: number; // 应当吸附到的坐标（画布百分比）
  dist: number;        // 鼠标距离吸附点的距离
  guidePos: number;    // 辅助线所在位置
  color: 'red' | 'yellow';
  id: string;
  gapIndicator?: SpacingGap;
}

/**
 * 拖动移动画框时的全向双向智能吸附与辅助线引擎 (基于屏幕物理像素自适应 + 磁力粘连)
 * 支持：
 * 1. 同页所有其他画框：左对左、右对右、顶对顶、底对底、左贴右、右贴左、顶贴底、底贴顶、中心对中心、中心对边缘、边缘对中心
 * 2. 物理毫米固定间距吸附 (Fixed Gap Snap, 如 2mm 紧齐)
 * 3. 页面参考线：页面水平中轴 (50%)、垂直中轴 (50%)、左/右/顶/底边缘 (0%, 100%)
 * 4. 多图等间距吸附 (Equal Spacing)
 */
export function calculateMoveSnap(
  currentId: string,
  candidateX: number,
  candidateY: number,
  width: number,
  height: number,
  otherSlots: FrameSlot[],
  containerPixelWidth?: number,
  containerPixelHeight?: number,
  fixedGapConfig?: FixedGapConfig
): SnapResult {
  let snappedX = candidateX;
  let snappedY = candidateY;

  // 动态根据容器在屏幕上的实际渲染物理像素，计算出恒定 7px~8px 的屏幕吸力阈值
  const thresholdX = containerPixelWidth && containerPixelWidth > 50
    ? Math.max(1.8, (8 / containerPixelWidth) * 100)
    : DEFAULT_SNAP_THRESHOLD;
  const thresholdY = containerPixelHeight && containerPixelHeight > 50
    ? Math.max(1.8, (8 / containerPixelHeight) * 100)
    : DEFAULT_SNAP_THRESHOLD;

  const currLeft = candidateX;
  const currRight = candidateX + width;
  const currCenterX = candidateX + width / 2;

  const currTop = candidateY;
  const currBottom = candidateY + height;
  const currCenterY = candidateY + height / 2;

  const others = (otherSlots || []).filter((s) => s.id !== currentId);

  // ==================== 1. X 轴候选吸附点计算 ====================
  const xCandidates: SnapCandidate[] = [];

  // 判定当前被拖拽的元素是否为照片画框（仅当拖拽照片画框且目标为照片画框时，才启用固定毫米间隙吸附；文字和图章素材免除固定间距约束）
  const currentSlot = otherSlots?.find((s) => s.id === currentId);
  const isCurrentPhotoFrame = !currentSlot || currentSlot.type === 'photo';

  // 1.1 画布基准（页面垂直中心线 50%）
  xCandidates.push({
    targetCoord: 50 - width / 2,
    dist: Math.abs(currCenterX - 50),
    guidePos: 50,
    color: 'yellow',
    id: 'page-center-x-50',
  });

  // 1.2 所有其他画框的 X 轴关键特征
  for (const target of others) {
    const tLeft = target.x;
    const tRight = target.x + target.width;
    const tCenterX = target.x + target.width / 2;

    // ① 中心对中心 (Center - Center) -> 权重优先
    xCandidates.push({
      targetCoord: tCenterX - width / 2,
      dist: Math.abs(currCenterX - tCenterX),
      guidePos: tCenterX,
      color: 'yellow',
      id: `center-center-x-${target.id}`,
    });

    // ② 左对左 (Left - Left) -> 画框吸附到 tLeft
    xCandidates.push({
      targetCoord: tLeft,
      dist: Math.abs(currLeft - tLeft),
      guidePos: tLeft,
      color: 'red',
      id: `left-left-${target.id}`,
    });

    // ③ 右对右 (Right - Right) -> 画框吸附到 tRight - width
    xCandidates.push({
      targetCoord: tRight - width,
      dist: Math.abs(currRight - tRight),
      guidePos: tRight,
      color: 'red',
      id: `right-right-${target.id}`,
    });

    // ④ 左贴右 (Left - Right, 贴齐右边缘, 0 间距贴齐)
    xCandidates.push({
      targetCoord: tRight,
      dist: Math.abs(currLeft - tRight),
      guidePos: tRight,
      color: 'red',
      id: `left-right-${target.id}`,
    });

    // ⑤ 右贴左 (Right - Left, 贴齐左边缘, 0 间距贴齐)
    xCandidates.push({
      targetCoord: tLeft - width,
      dist: Math.abs(currRight - tLeft),
      guidePos: tLeft,
      color: 'red',
      id: `right-left-${target.id}`,
    });

    // ★★★ 核心：固定毫米间距吸附 (Fixed Gap Snap) 严格限定于照片画框与照片画框之间，对文字与素材不生效 ★★★
    const isTargetPhotoFrame = target.type === 'photo';
    if (isCurrentPhotoFrame && isTargetPhotoFrame && fixedGapConfig && fixedGapConfig.enabled && fixedGapConfig.gapPercentX > 0) {
      const gapX = fixedGapConfig.gapPercentX;
      const gapLabel = `${fixedGapConfig.gapMm} mm`;

      // 目标右侧留出 fixedGap (当前画框左边在 target.right + gapX)
      const targetCoordRight = tRight + gapX;
      const distRight = Math.abs(currLeft - targetCoordRight);

      xCandidates.push({
        targetCoord: targetCoordRight,
        dist: distRight,
        guidePos: tRight,
        color: 'red',
        id: `fixed-gap-right-${target.id}`,
        gapIndicator: {
          id: `fixed-gap-right-${target.id}`,
          x: tRight,
          y: candidateY,
          width: gapX,
          height: height,
          orientation: 'horizontal',
          label: gapLabel,
        },
      });

      // 目标左侧留出 fixedGap (当前画框右边在 target.left - gapX)
      const targetCoordLeft = tLeft - gapX - width;
      const distLeft = Math.abs(currRight - (tLeft - gapX));
      xCandidates.push({
        targetCoord: targetCoordLeft,
        dist: distLeft,
        guidePos: tLeft,
        color: 'red',
        id: `fixed-gap-left-${target.id}`,
        gapIndicator: {
          id: `fixed-gap-left-${target.id}`,
          x: tLeft - gapX,
          y: candidateY,
          width: gapX,
          height: height,
          orientation: 'horizontal',
          label: gapLabel,
        },
      });
    }

    // ⑥ 当前中心对齐目标左/右边缘
    xCandidates.push({
      targetCoord: tLeft - width / 2,
      dist: Math.abs(currCenterX - tLeft),
      guidePos: tLeft,
      color: 'yellow',
      id: `center-left-${target.id}`,
    });
    xCandidates.push({
      targetCoord: tRight - width / 2,
      dist: Math.abs(currCenterX - tRight),
      guidePos: tRight,
      color: 'yellow',
      id: `center-right-${target.id}`,
    });

    // ⑦ 当前左/右边缘对齐目标中心
    xCandidates.push({
      targetCoord: tCenterX,
      dist: Math.abs(currLeft - tCenterX),
      guidePos: tCenterX,
      color: 'yellow',
      id: `left-center-${target.id}`,
    });
    xCandidates.push({
      targetCoord: tCenterX - width,
      dist: Math.abs(currRight - tCenterX),
      guidePos: tCenterX,
      color: 'yellow',
      id: `right-center-${target.id}`,
    });
  }

  // 筛选出在阈值内且距离最近的 X 磁吸点 (使用动态屏幕像素阈值)
  const validX = xCandidates.filter((c) => c.dist <= thresholdX);
  validX.sort((a, b) => a.dist - b.dist);

  let bestXSnap: SnapCandidate | null = null;
  if (validX.length > 0) {
    bestXSnap = validX[0];
    snappedX = bestXSnap.targetCoord;
  }

  // ==================== 2. Y 轴候选吸附点计算 ====================
  const yCandidates: SnapCandidate[] = [];

  // 2.1 画布基准（页面水平中心线 50%）
  yCandidates.push({
    targetCoord: 50 - height / 2,
    dist: Math.abs(currCenterY - 50),
    guidePos: 50,
    color: 'yellow',
    id: 'page-center-y-50',
  });

  // 2.2 所有其他画框的 Y 轴关键特征
  for (const target of others) {
    const tTop = target.y;
    const tBottom = target.y + target.height;
    const tCenterY = target.y + target.height / 2;
    const isTargetPhotoFrame = target.type === 'photo';

    // ① 中心对中心 (Center - Center) -> 权重优先
    yCandidates.push({
      targetCoord: tCenterY - height / 2,
      dist: Math.abs(currCenterY - tCenterY),
      guidePos: tCenterY,
      color: 'yellow',
      id: `center-center-y-${target.id}`,
    });

    // ② 顶对顶 (Top - Top)
    yCandidates.push({
      targetCoord: tTop,
      dist: Math.abs(currTop - tTop),
      guidePos: tTop,
      color: 'red',
      id: `top-top-${target.id}`,
    });

    // ③ 底对底 (Bottom - Bottom)
    yCandidates.push({
      targetCoord: tBottom - height,
      dist: Math.abs(currBottom - tBottom),
      guidePos: tBottom,
      color: 'red',
      id: `bottom-bottom-${target.id}`,
    });

    // ④ 顶贴底 (Top - Bottom, 贴齐下边缘)
    yCandidates.push({
      targetCoord: tBottom,
      dist: Math.abs(currTop - tBottom),
      guidePos: tBottom,
      color: 'red',
      id: `top-bottom-${target.id}`,
    });

    // ⑤ 底贴顶 (Bottom - Top, 贴齐上边缘)
    yCandidates.push({
      targetCoord: tTop - height,
      dist: Math.abs(currBottom - tTop),
      guidePos: tTop,
      color: 'red',
      id: `bottom-top-${target.id}`,
    });

    // ★★★ 核心：固定毫米间距垂直吸附 (Fixed Gap Snap) 严格限定于照片画框与照片画框之间，对文字与素材不生效 ★★★
    if (isCurrentPhotoFrame && isTargetPhotoFrame && fixedGapConfig && fixedGapConfig.enabled && fixedGapConfig.gapPercentY > 0) {
      const gapY = fixedGapConfig.gapPercentY;
      const gapLabel = `${fixedGapConfig.gapMm} mm`;

      // 目标下方留出 fixedGap (当前画框顶边在 target.bottom + gapY)
      const targetCoordBottom = tBottom + gapY;
      const distBottom = Math.abs(currTop - targetCoordBottom);

      yCandidates.push({
        targetCoord: targetCoordBottom,
        dist: distBottom,
        guidePos: tBottom,
        color: 'red',
        id: `fixed-gap-bottom-${target.id}`,
        gapIndicator: {
          id: `fixed-gap-bottom-${target.id}`,
          x: candidateX,
          y: tBottom,
          width: width,
          height: gapY,
          orientation: 'vertical',
          label: gapLabel,
        },
      });

      // 目标上方留出 fixedGap (当前画框底边在 target.top - gapY)
      const targetCoordTop = tTop - gapY - height;
      const distTop = Math.abs(currBottom - (tTop - gapY));
      yCandidates.push({
        targetCoord: targetCoordTop,
        dist: distTop,
        guidePos: tTop,
        color: 'red',
        id: `fixed-gap-top-${target.id}`,
        gapIndicator: {
          id: `fixed-gap-top-${target.id}`,
          x: candidateX,
          y: tTop - gapY,
          width: width,
          height: gapY,
          orientation: 'vertical',
          label: gapLabel,
        },
      });
    }

    // ⑥ 当前中心对齐目标顶/底边缘
    yCandidates.push({
      targetCoord: tTop - height / 2,
      dist: Math.abs(currCenterY - tTop),
      guidePos: tTop,
      color: 'yellow',
      id: `center-top-${target.id}`,
    });
    yCandidates.push({
      targetCoord: tBottom - height / 2,
      dist: Math.abs(currCenterY - tBottom),
      guidePos: tBottom,
      color: 'yellow',
      id: `center-bottom-${target.id}`,
    });

    // ⑦ 当前顶/底边缘对齐目标中心
    yCandidates.push({
      targetCoord: tCenterY,
      dist: Math.abs(currTop - tCenterY),
      guidePos: tCenterY,
      color: 'yellow',
      id: `top-center-${target.id}`,
    });
    yCandidates.push({
      targetCoord: tCenterY - height,
      dist: Math.abs(currBottom - tCenterY),
      guidePos: tCenterY,
      color: 'yellow',
      id: `bottom-center-${target.id}`,
    });
  }

  // 筛选出在阈值内且距离最近的 Y 磁吸点 (使用动态屏幕像素阈值)
  const validY = yCandidates.filter((c) => c.dist <= thresholdY);
  validY.sort((a, b) => a.dist - b.dist);

  let bestYSnap: SnapCandidate | null = null;
  if (validY.length > 0) {
    bestYSnap = validY[0];
    snappedY = bestYSnap.targetCoord;
  }

  // ==================== 3. 等间距吸附 (Equal Spacing Snap) ====================
  const gapResult = checkSpacingGaps(
    currentId,
    candidateX,
    candidateY,
    width,
    height,
    otherSlots,
    thresholdX,
    thresholdY
  );

  if (gapResult.snapped) {
    if (gapResult.snappedX !== undefined) {
      snappedX = gapResult.snappedX;
    }
    if (gapResult.snappedY !== undefined) {
      snappedY = gapResult.snappedY;
    }
  }

  // 汇总所有间隙高亮指示块
  const finalGaps: SpacingGap[] = [...gapResult.spacingGaps];
  if (bestXSnap?.gapIndicator) {
    finalGaps.push(bestXSnap.gapIndicator);
  }
  if (bestYSnap?.gapIndicator) {
    finalGaps.push(bestYSnap.gapIndicator);
  }

  // ==================== 4. 辅助线收集与精准去重 ====================
  const guides: GuideLine[] = [];

  // 如果有 X 轴最佳磁吸
  if (bestXSnap) {
    guides.push({
      id: `guide-x-${bestXSnap.id}`,
      orientation: 'vertical',
      position: Number(bestXSnap.guidePos.toFixed(2)),
      color: bestXSnap.color,
    });

    // 联动检查：如果还有其他兄弟图框也正好处于同一 X 辅助线上，一并保持稳定
    for (const c of validX) {
      if (Math.abs(c.guidePos - bestXSnap.guidePos) < 0.05 && c.id !== bestXSnap.id) {
        guides.push({
          id: `guide-x-${c.id}`,
          orientation: 'vertical',
          position: Number(c.guidePos.toFixed(2)),
          color: c.color,
        });
      }
    }
  }

  // 如果有 Y 轴最佳磁吸
  if (bestYSnap) {
    guides.push({
      id: `guide-y-${bestYSnap.id}`,
      orientation: 'horizontal',
      position: Number(bestYSnap.guidePos.toFixed(2)),
      color: bestYSnap.color,
    });

    // 联动检查：如果还有其他兄弟图框也正好处于同一 Y 辅助线上，一并保持稳定
    for (const c of validY) {
      if (Math.abs(c.guidePos - bestYSnap.guidePos) < 0.05 && c.id !== bestYSnap.id) {
        guides.push({
          id: `guide-y-${c.id}`,
          orientation: 'horizontal',
          position: Number(c.guidePos.toFixed(2)),
          color: c.color,
        });
      }
    }
  }

  // 最终安全钳制 (0 - 100)
  snappedX = Math.max(0, Math.min(100 - width, snappedX));
  snappedY = Math.max(0, Math.min(100 - height, snappedY));

  // 去重
  const uniqueGuides: GuideLine[] = [];
  const visited = new Set<string>();
  for (const g of guides) {
    const key = `${g.orientation}-${g.position.toFixed(2)}-${g.color}`;
    if (!visited.has(key)) {
      visited.add(key);
      uniqueGuides.push(g);
    }
  }

  return {
    x: Number(snappedX.toFixed(2)),
    y: Number(snappedY.toFixed(2)),
    width,
    height,
    guides: uniqueGuides,
    spacingGaps: finalGaps,
  };
}

/**
 * 计算三图/多图等间距吸附与粉红色间隙高亮区
 */
function checkSpacingGaps(
  currentId: string,
  candidateX: number,
  candidateY: number,
  width: number,
  height: number,
  otherSlots: FrameSlot[],
  thresholdX: number = DEFAULT_SNAP_THRESHOLD,
  thresholdY: number = DEFAULT_SNAP_THRESHOLD
): {
  snapped: boolean;
  snappedX?: number;
  snappedY?: number;
  spacingGaps: SpacingGap[];
} {
  const gaps: SpacingGap[] = [];
  let snapped = false;
  let finalX: number | undefined = undefined;
  let finalY: number | undefined = undefined;

  // 严格限定：等间距计算仅在被拖拽元素是照片画框，且目标也是照片画框时生效
  const currentSlot = otherSlots?.find((s) => s.id === currentId);
  const isCurrentPhotoFrame = !currentSlot || currentSlot.type === 'photo';
  if (!isCurrentPhotoFrame) {
    return { snapped: false, spacingGaps: [] };
  }

  const others = (otherSlots || []).filter((s) => s.id !== currentId && s.type === 'photo');
  if (others.length < 2) {
    return { snapped: false, spacingGaps: [] };
  }

  // --- 1. 水平方向等间距 (Horizontal Spacing: A -> Candidate -> B) ---
  for (let i = 0; i < others.length; i++) {
    for (let j = 0; j < others.length; j++) {
      if (i === j) continue;
      const A = others[i];
      const B = others[j];

      // A 在左侧，B 在右侧
      if (A.x + A.width < B.x) {
        const aRight = A.x + A.width;
        const bLeft = B.x;
        const totalSpace = bLeft - aRight;
        const availableGap = totalSpace - width;

        if (availableGap > 0) {
          const equalGap = availableGap / 2;
          const targetX = aRight + equalGap;

          // 判定当前拖拽的画框是否接近居中等距位置
          if (Math.abs(candidateX - targetX) < thresholdX * 1.2) {
            finalX = targetX;
            snapped = true;

            // 柱状条的纵向覆盖范围 (与 A、当前图、B 共同包络)
            const minY = Math.min(A.y, candidateY, B.y);
            const maxY = Math.max(A.y + A.height, candidateY + height, B.y + B.height);
            const colHeight = maxY - minY;

            gaps.push({
              id: `gap-h-left-${A.id}`,
              x: aRight,
              y: minY,
              width: equalGap,
              height: colHeight,
              orientation: 'horizontal',
            });

            gaps.push({
              id: `gap-h-right-${B.id}`,
              x: targetX + width,
              y: minY,
              width: equalGap,
              height: colHeight,
              orientation: 'horizontal',
            });
            break;
          }
        }
      }
    }
    if (finalX !== undefined) break;
  }

  // --- 2. 垂直方向等间距 (Vertical Spacing: A -> Candidate -> B) ---
  for (let i = 0; i < others.length; i++) {
    for (let j = 0; j < others.length; j++) {
      if (i === j) continue;
      const A = others[i];
      const B = others[j];

      if (A.y + A.height < B.y) {
        const aBottom = A.y + A.height;
        const bTop = B.y;
        const totalSpace = bTop - aBottom;
        const availableGap = totalSpace - height;

        if (availableGap > 0) {
          const equalGap = availableGap / 2;
          const targetY = aBottom + equalGap;

          if (Math.abs(candidateY - targetY) < thresholdY * 1.2) {
            finalY = targetY;
            snapped = true;

            const minX = Math.min(A.x, candidateX, B.x);
            const maxX = Math.max(A.x + A.width, candidateX + width, B.x + B.width);
            const rowWidth = maxX - minX;

            gaps.push({
              id: `gap-v-top-${A.id}`,
              x: minX,
              y: aBottom,
              width: rowWidth,
              height: equalGap,
              orientation: 'vertical',
            });

            gaps.push({
              id: `gap-v-bottom-${B.id}`,
              x: minX,
              y: targetY + height,
              width: rowWidth,
              height: equalGap,
              orientation: 'vertical',
            });
            break;
          }
        }
      }
    }
    if (finalY !== undefined) break;
  }

  return { snapped, snappedX: finalX, snappedY: finalY, spacingGaps: gaps };
}

/**
 * 8 锚点拖拽拉伸缩放时的智能边缘吸附与辅助线
 */
export function calculateResizeSnap(
  currentId: string,
  candidateX: number,
  candidateY: number,
  candidateWidth: number,
  candidateHeight: number,
  activeHandle: string,
  otherSlots: FrameSlot[],
  containerPixelWidth?: number,
  containerPixelHeight?: number,
  fixedGapConfig?: FixedGapConfig
): SnapResult {
  let snappedX = candidateX;
  let snappedY = candidateY;
  let snappedW = candidateWidth;
  let snappedH = candidateHeight;
  const guides: GuideLine[] = [];

  const thresholdX = containerPixelWidth && containerPixelWidth > 50
    ? Math.max(2.2, (8 / containerPixelWidth) * 100)
    : DEFAULT_SNAP_THRESHOLD;
  const thresholdY = containerPixelHeight && containerPixelHeight > 50
    ? Math.max(2.2, (8 / containerPixelHeight) * 100)
    : DEFAULT_SNAP_THRESHOLD;

  const others = (otherSlots || []).filter((s) => s.id !== currentId);

  interface ResizeCandidate {
    guidePos: number;
    dist: number;
    color: 'red' | 'yellow';
    id: string;
    gapIndicator?: SpacingGap;
    apply: (pos: number) => void;
  }

  // ==================== X 轴拉伸吸附候选 ====================
  const xCandidates: ResizeCandidate[] = [];

  if (activeHandle.includes('e')) {
    const currentRight = candidateX + candidateWidth;

    for (const target of others) {
      const targetLeft = target.x;
      const targetRight = target.x + target.width;

      // 固定间隙拉伸吸附：拉到与 targetLeft 相距 fixedGap
      if (fixedGapConfig?.enabled && fixedGapConfig.gapPercentX > 0) {
        const gapTarget = targetLeft - fixedGapConfig.gapPercentX;
        const gapX = fixedGapConfig.gapPercentX;
        const gapLabel = `${fixedGapConfig.gapMm} mm`;

        xCandidates.push({
          guidePos: targetLeft,
          dist: Math.abs(currentRight - gapTarget),
          color: 'red',
          id: `resize-right-fixedgap-${target.id}`,
          gapIndicator: {
            id: `resize-gap-right-${target.id}`,
            x: targetLeft - gapX,
            y: candidateY,
            width: gapX,
            height: candidateHeight,
            orientation: 'horizontal',
            label: gapLabel,
          },
          apply: () => {
            snappedW = gapTarget - candidateX;
          },
        });
      }

      xCandidates.push({
        guidePos: targetRight,
        dist: Math.abs(currentRight - targetRight),
        color: 'red',
        id: `resize-right-right-${target.id}`,
        apply: (pos) => {
          snappedW = pos - candidateX;
        },
      });
      xCandidates.push({
        guidePos: targetLeft,
        dist: Math.abs(currentRight - targetLeft),
        color: 'red',
        id: `resize-right-left-${target.id}`,
        apply: (pos) => {
          snappedW = pos - candidateX;
        },
      });
    }
  } else if (activeHandle.includes('w')) {
    const currentLeft = candidateX;

    for (const target of others) {
      const targetLeft = target.x;
      const targetRight = target.x + target.width;

      // 固定间隙拉伸吸附：拉到与 targetRight 相距 fixedGap
      if (fixedGapConfig?.enabled && fixedGapConfig.gapPercentX > 0) {
        const gapTarget = targetRight + fixedGapConfig.gapPercentX;
        const gapX = fixedGapConfig.gapPercentX;
        const gapLabel = `${fixedGapConfig.gapMm} mm`;

        xCandidates.push({
          guidePos: targetRight,
          dist: Math.abs(currentLeft - gapTarget),
          color: 'red',
          id: `resize-left-fixedgap-${target.id}`,
          gapIndicator: {
            id: `resize-gap-left-${target.id}`,
            x: targetRight,
            y: candidateY,
            width: gapX,
            height: candidateHeight,
            orientation: 'horizontal',
            label: gapLabel,
          },
          apply: () => {
            const diff = candidateX - gapTarget;
            snappedX = gapTarget;
            snappedW = candidateWidth + diff;
          },
        });
      }

      xCandidates.push({
        guidePos: targetLeft,
        dist: Math.abs(currentLeft - targetLeft),
        color: 'red',
        id: `resize-left-left-${target.id}`,
        apply: (pos) => {
          const diff = candidateX - pos;
          snappedX = pos;
          snappedW = candidateWidth + diff;
        },
      });
      xCandidates.push({
        guidePos: targetRight,
        dist: Math.abs(currentLeft - targetRight),
        color: 'red',
        id: `resize-left-right-${target.id}`,
        apply: (pos) => {
          const diff = candidateX - pos;
          snappedX = pos;
          snappedW = candidateWidth + diff;
        },
      });
    }
  }

  // 筛选出在阈值内且距离最近的 X 磁吸点 (单轴仅选最优 1 条)
  const validX = xCandidates.filter((c) => c.dist <= thresholdX);
  validX.sort((a, b) => a.dist - b.dist);
  let bestXSnap: ResizeCandidate | null = null;
  if (validX.length > 0) {
    bestXSnap = validX[0];
    bestXSnap.apply(bestXSnap.guidePos);
    guides.push({
      id: bestXSnap.id,
      orientation: 'vertical',
      position: Number(bestXSnap.guidePos.toFixed(2)),
      color: bestXSnap.color,
    });
  }

  // ==================== Y 轴拉伸吸附候选 ====================
  const yCandidates: ResizeCandidate[] = [];

  if (activeHandle.includes('s')) {
    const currentBottom = candidateY + candidateHeight;

    for (const target of others) {
      const targetTop = target.y;
      const targetBottom = target.y + target.height;

      // 固定间隙拉伸吸附：拉到与 targetTop 相距 fixedGap
      if (fixedGapConfig?.enabled && fixedGapConfig.gapPercentY > 0) {
        const gapTarget = targetTop - fixedGapConfig.gapPercentY;
        const gapY = fixedGapConfig.gapPercentY;
        const gapLabel = `${fixedGapConfig.gapMm} mm`;

        yCandidates.push({
          guidePos: targetTop,
          dist: Math.abs(currentBottom - gapTarget),
          color: 'red',
          id: `resize-bottom-fixedgap-${target.id}`,
          gapIndicator: {
            id: `resize-gap-bottom-${target.id}`,
            x: candidateX,
            y: targetTop - gapY,
            width: candidateWidth,
            height: gapY,
            orientation: 'vertical',
            label: gapLabel,
          },
          apply: () => {
            snappedH = gapTarget - candidateY;
          },
        });
      }

      yCandidates.push({
        guidePos: targetBottom,
        dist: Math.abs(currentBottom - targetBottom),
        color: 'red',
        id: `resize-bottom-bottom-${target.id}`,
        apply: (pos) => {
          snappedH = pos - candidateY;
        },
      });
      yCandidates.push({
        guidePos: targetTop,
        dist: Math.abs(currentBottom - targetTop),
        color: 'red',
        id: `resize-bottom-top-${target.id}`,
        apply: (pos) => {
          snappedH = pos - candidateY;
        },
      });
    }
  } else if (activeHandle.includes('n')) {
    const currentTop = candidateY;

    for (const target of others) {
      const targetTop = target.y;
      const targetBottom = target.y + target.height;

      // 固定间隙拉伸吸附：拉到与 targetBottom 相距 fixedGap
      if (fixedGapConfig?.enabled && fixedGapConfig.gapPercentY > 0) {
        const gapTarget = targetBottom + fixedGapConfig.gapPercentY;
        const gapY = fixedGapConfig.gapPercentY;
        const gapLabel = `${fixedGapConfig.gapMm} mm`;

        yCandidates.push({
          guidePos: targetBottom,
          dist: Math.abs(currentTop - gapTarget),
          color: 'red',
          id: `resize-top-fixedgap-${target.id}`,
          gapIndicator: {
            id: `resize-gap-top-${target.id}`,
            x: candidateX,
            y: targetBottom,
            width: candidateWidth,
            height: gapY,
            orientation: 'vertical',
            label: gapLabel,
          },
          apply: () => {
            const diff = candidateY - gapTarget;
            snappedY = gapTarget;
            snappedH = candidateHeight + diff;
          },
        });
      }

      yCandidates.push({
        guidePos: targetTop,
        dist: Math.abs(currentTop - targetTop),
        color: 'red',
        id: `resize-top-top-${target.id}`,
        apply: (pos) => {
          const diff = candidateY - pos;
          snappedY = pos;
          snappedH = candidateHeight + diff;
        },
      });
      yCandidates.push({
        guidePos: targetBottom,
        dist: Math.abs(currentTop - targetBottom),
        color: 'red',
        id: `resize-top-bottom-${target.id}`,
        apply: (pos) => {
          const diff = candidateY - pos;
          snappedY = pos;
          snappedH = candidateHeight + diff;
        },
      });
    }
  }

  // 筛选出在阈值内且距离最近的 Y 磁吸点 (单轴仅选最优 1 条)
  const validY = yCandidates.filter((c) => c.dist <= thresholdY);
  validY.sort((a, b) => a.dist - b.dist);
  let bestYSnap: ResizeCandidate | null = null;
  if (validY.length > 0) {
    bestYSnap = validY[0];
    bestYSnap.apply(bestYSnap.guidePos);
    guides.push({
      id: bestYSnap.id,
      orientation: 'horizontal',
      position: Number(bestYSnap.guidePos.toFixed(2)),
      color: bestYSnap.color,
    });
  }

  // 收集所有激活的间距高亮区 (固定间隙高亮 + 多图等间距高亮)
  const finalGaps: SpacingGap[] = [];
  if (bestXSnap?.gapIndicator) {
    finalGaps.push(bestXSnap.gapIndicator);
  }
  if (bestYSnap?.gapIndicator) {
    finalGaps.push(bestYSnap.gapIndicator);
  }

  // 边缘拉伸时的三图/多图等间距检测
  const equalSpacingRes = checkSpacingGaps(
    currentId,
    snappedX,
    snappedY,
    snappedW,
    snappedH,
    others,
    thresholdX,
    thresholdY
  );
  if (equalSpacingRes.spacingGaps.length > 0) {
    finalGaps.push(...equalSpacingRes.spacingGaps);
  }

  // 去重
  const uniqueGuides: GuideLine[] = [];
  const visited = new Set<string>();
  for (const g of guides) {
    const key = `${g.orientation}-${g.position.toFixed(2)}-${g.color}`;
    if (!visited.has(key)) {
      visited.add(key);
      uniqueGuides.push(g);
    }
  }

  return {
    x: Number(snappedX.toFixed(2)),
    y: Number(snappedY.toFixed(2)),
    width: Math.max(5, Number(snappedW.toFixed(2))),
    height: Math.max(5, Number(snappedH.toFixed(2))),
    guides: uniqueGuides,
    spacingGaps: finalGaps,
  };
}

