import React from 'react';
import { MaskShape } from '../types/editor';

export type MaskCategory = 'all' | 'basic' | 'texture' | 'cute' | 'symbol' | 'vintage';

export interface MaskDefinition {
  id: MaskShape;
  name: string;
  category?: MaskCategory;
  // SVG 0-100 viewBox 渲染路径 (供 0-100 缩略图与 objectBoundingBox 0-1 换算)
  pathD?: string;
  // 自定义 SVG 内部元素渲染（如带孔、带圆的复杂图形）
  svgContent?: React.ReactNode;
  // CSS clip-path 样式直接应用（如有原生极简写法）
  cssClipPath?: string;
  // 是否为默认矩形
  isNone?: boolean;
}

export const MOMO_MASK_CATEGORIES: { id: MaskCategory; name: string; count?: number }[] = [
  { id: 'all', name: '全部' },
  { id: 'basic', name: '基础几何' },
  { id: 'texture', name: '艺术质感' },
  { id: 'cute', name: '萌宠自然' },
  { id: 'symbol', name: '符号气泡' },
  { id: 'vintage', name: '复古花边' },
];

/**
 * 将任意 SVG path 坐标系精准归一化并映射至 0.0 - 1.0 满幅坐标系 (用于 clipPathUnits="objectBoundingBox")
 * 确保蒙版紧贴画框 8 锚点边缘，使照片大小不变、手柄紧密贴合外边缘
 */
export function normalizePathBoundingBox(pathD: string, targetMin = 0, targetMax = 1): string {
  if (!pathD) return '';
  // 提取路径指令与所有数值
  const tokens = pathD.match(/[a-df-z]|[-+]?[0-9]*\.?[0-9]+(?:e[-+]?[0-9]+)?/gi);
  if (!tokens) return pathD;

  // 第 1 遍扫描：计算该图形在 X 和 Y 轴向上的真实外边界 [minX, maxX, minY, maxY]
  let isX = true;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^[a-df-z]$/i.test(token)) {
      if (token.toUpperCase() === 'Z') {
        continue;
      }
      isX = true;
    } else {
      const val = parseFloat(token);
      if (!isNaN(val)) {
        if (isX) {
          if (val < minX) minX = val;
          if (val > maxX) maxX = val;
        } else {
          if (val < minY) minY = val;
          if (val > maxY) maxY = val;
        }
        isX = !isX;
      }
    }
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const targetRange = targetMax - targetMin;

  // 第 2 遍扫描：等比映射并重组路径，使顶点严格接触 0.0 与 1.0
  isX = true;
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (/^[a-df-z]$/i.test(token)) {
      result.push(token);
      if (token.toUpperCase() !== 'Z') {
        isX = true;
      }
    } else {
      const val = parseFloat(token);
      if (!isNaN(val)) {
        let mapped: number;
        if (isX) {
          mapped = targetMin + ((val - minX) / rangeX) * targetRange;
        } else {
          mapped = targetMin + ((val - minY) / rangeY) * targetRange;
        }
        // 保留 4 位高精度小数
        result.push((Math.round(mapped * 10000) / 10000).toString());
        isX = !isX;
      } else {
        result.push(token);
      }
    }
  }

  return result.join(' ');
}

/**
 * 将 0-100 坐标系的 SVG path 字符串精准转换为 0.0 - 1.0 满格坐标系 (用于 clipPathUnits="objectBoundingBox")
 */
export function convertPathToUnitBoundingBox(pathD: string): string {
  return normalizePathBoundingBox(pathD, 0, 1);
}

/**
 * 米莫印品 40+ 经典高精度矢量遮罩库 (1:1 提取复刻自米莫印刷系统)
 */
export const MOMO_MASK_DEFINITIONS: MaskDefinition[] = [
  {
    id: 'none',
    name: '原图无蒙版',
    category: 'basic',
    isNone: true,
  },
  {
    id: 'rounded_rect',
    name: '大圆角矩形',
    category: 'basic',
    pathD: 'M 30 10 L 70 10 C 86 10 94 18 94 34 L 94 66 C 94 82 86 90 70 90 L 30 90 C 14 90 6 82 6 66 L 6 34 C 6 18 14 10 30 10 Z',
  },
  {
    id: 'circle',
    name: '正圆形',
    category: 'basic',
    pathD: 'M 50 8 C 73.2 8 92 26.8 92 50 C 92 73.2 73.2 92 50 92 C 26.8 92 8 73.2 8 50 C 8 26.8 26.8 8 50 8 Z',
  },
  {
    id: 'oval_h',
    name: '横向大椭圆',
    category: 'basic',
    pathD: 'M 50 20 C 76 20 96 34 96 50 C 96 66 76 80 50 80 C 24 80 4 66 4 50 C 4 34 24 20 50 20 Z',
  },
  {
    id: 'egg',
    name: '鹅卵石椭圆',
    category: 'basic',
    pathD: 'M 50 6 C 75 6 93 28 93 58 C 93 78 74 94 50 94 C 26 94 7 78 7 58 C 7 28 25 6 50 6 Z',
  },
  {
    id: 'hexagon',
    name: '倒角六边形',
    category: 'basic',
    pathD: 'M 50 5 C 54 5 57 7 60 9 L 90 27 C 94 29 96 33 96 37 L 96 63 C 96 67 94 71 90 73 L 60 91 C 57 93 54 95 50 95 C 46 95 43 93 40 91 L 10 73 C 6 71 4 67 4 63 L 4 37 C 4 33 6 29 10 27 L 40 9 C 43 7 46 5 50 5 Z',
  },
  {
    id: 'arch',
    name: '半圆顶大拱门',
    category: 'basic',
    pathD: 'M 8 92 L 8 48 C 8 24 26 6 50 6 C 74 6 92 24 92 48 L 92 92 Z',
  },
  {
    id: 'arch_tall',
    name: '高拱门',
    category: 'basic',
    pathD: 'M 14 96 L 14 42 C 14 18 30 6 50 6 C 70 6 86 18 86 42 L 86 96 Z',
  },
  {
    id: 'pill_h',
    name: '横向药丸胶囊',
    category: 'basic',
    pathD: 'M 32 20 L 68 20 C 84 20 94 32 94 50 C 94 68 84 80 68 80 L 32 80 C 16 80 6 68 6 50 C 6 32 16 20 32 20 Z',
  },
  {
    id: 'pill_right',
    name: '左方右圆',
    category: 'basic',
    pathD: 'M 8 22 L 64 22 C 82 22 92 34 92 50 C 92 66 82 78 64 78 L 8 78 Z',
  },
  {
    id: 'pill_left',
    name: '左圆右方',
    category: 'basic',
    pathD: 'M 36 22 L 92 22 L 92 78 L 36 78 C 18 78 8 66 8 50 C 8 34 18 22 36 22 Z',
  },
  {
    id: 'triangle_up',
    name: '正三角形',
    category: 'basic',
    pathD: 'M 50 8 L 94 90 L 6 90 Z',
  },
  {
    id: 'triangle_down',
    name: '倒三角形',
    category: 'basic',
    pathD: 'M 6 10 L 94 10 L 50 92 Z',
  },
  // --- 艺术质感 ---
  {
    id: 'tape',
    name: '撕纸胶带',
    category: 'texture',
    pathD: 'M 12 12 L 88 12 L 88 20 L 83 26 L 88 32 L 83 38 L 88 44 L 83 50 L 88 56 L 83 62 L 88 68 L 83 74 L 88 80 L 88 88 L 12 88 L 12 80 L 17 74 L 12 68 L 17 62 L 12 56 L 17 50 L 12 44 L 17 38 L 12 32 L 17 26 L 12 20 Z',
  },
  {
    id: 'brush',
    name: '艺术水彩笔刷',
    category: 'texture',
    pathD: 'M 14 18 C 22 14 38 18 50 14 C 62 10 78 16 86 18 C 92 26 88 42 90 54 C 92 68 86 82 82 86 C 72 90 58 84 46 88 C 32 92 18 86 12 80 C 8 70 14 56 10 44 C 6 32 10 22 14 18 Z',
  },
  {
    id: 'tilted_left',
    name: '左倾斜书页',
    category: 'texture',
    pathD: 'M 18 6 L 94 12 L 82 94 L 6 88 Z',
  },
  {
    id: 'tilted_right',
    name: '右倾斜书页',
    category: 'texture',
    pathD: 'M 6 12 L 82 6 L 94 88 L 18 94 Z',
  },
  {
    id: 'banner_curve',
    name: '下凹条幅弧形',
    category: 'texture',
    pathD: 'M 6 16 L 94 16 L 94 72 Q 50 88 6 72 Z',
  },
  {
    id: 'wave_left',
    name: '左侧波浪内凹',
    category: 'texture',
    pathD: 'M 8 6 L 94 6 L 94 94 L 8 94 Q 28 50 8 6 Z',
  },
  {
    id: 'wave_right',
    name: '右侧波浪内凹',
    category: 'texture',
    pathD: 'M 6 6 L 92 6 Q 72 50 92 94 L 6 94 Z',
  },
  {
    id: 'wave_both',
    name: '双侧内凹曲线',
    category: 'texture',
    pathD: 'M 6 6 Q 26 50 6 94 L 94 94 Q 74 50 94 6 Z',
  },
  // --- 萌宠自然 ---
  {
    id: 'cat',
    name: '萌宠小猫咪',
    category: 'cute',
    pathD: 'M 20 18 L 33 32 C 38 30 44 29 50 29 C 56 29 62 30 67 32 L 80 18 C 84 14 91 19 89 26 L 86 42 C 92 48 95 56 95 64 C 95 82 75 96 50 96 C 25 96 5 82 5 64 C 5 56 8 48 14 42 L 11 26 C 9 19 16 14 20 18 Z',
  },
  {
    id: 'bear',
    name: '萌宠小熊',
    category: 'cute',
    pathD: 'M 24 10 C 32 10 38 16 38 24 C 38 25 38 26 37 27 C 41 25 45 24 50 24 C 55 24 59 25 63 27 C 62 26 62 25 62 24 C 62 16 68 10 76 10 C 84 10 90 16 90 24 C 90 31 85 37 79 38 C 89 45 95 56 95 68 C 95 84 75 97 50 97 C 25 97 5 84 5 68 C 5 56 11 45 21 38 C 15 37 10 31 10 24 C 10 16 16 10 24 10 Z',
  },
  {
    id: 'mickey',
    name: '米奇大耳头',
    category: 'cute',
    pathD: 'M 26 8 C 36 8 44 16 44 26 C 44 28 43 30 42 32 C 45 31 47 30 50 30 C 53 30 55 31 58 32 C 57 30 56 28 56 26 C 56 16 64 8 74 8 C 84 8 92 16 92 26 C 92 35 86 42 78 44 C 88 52 94 64 94 76 C 94 90 74 98 50 98 C 26 98 6 90 6 76 C 6 64 12 52 22 44 C 14 42 8 35 8 26 C 8 16 16 8 26 8 Z',
  },
  {
    id: 'blob_cloud',
    name: '灵动云朵',
    category: 'cute',
    pathD: 'M 32 30 C 38 14 58 14 66 26 C 78 20 90 32 88 44 C 98 54 94 72 82 76 C 80 88 64 92 54 86 C 44 94 28 88 24 78 C 10 76 8 58 18 48 C 14 36 24 24 32 30 Z',
  },
  {
    id: 'fish',
    name: '小鱼儿',
    category: 'cute',
    pathD: 'M 8 50 C 8 30 35 15 62 15 C 68 15 74 17 78 20 L 96 8 L 90 50 L 96 92 L 78 80 C 74 83 68 85 62 85 C 35 85 8 70 8 50 Z',
  },
  {
    id: 'apple',
    name: '小苹果',
    category: 'cute',
    pathD: 'M 50 28 C 50 18 58 10 68 8 C 68 18 60 26 50 28 Z M 50 30 C 44 26 34 24 26 24 C 12 24 4 36 4 52 C 4 76 28 94 50 94 C 72 94 96 76 96 52 C 96 36 88 24 74 24 C 66 24 56 26 50 30 Z',
  },
  {
    id: 'flower',
    name: '太阳花瓣圆',
    category: 'cute',
    pathD: 'M 50 6 C 56 6 60 12 65 14 C 70 16 76 14 80 18 C 84 22 84 28 86 33 C 88 38 94 42 94 48 C 94 54 88 58 86 63 C 84 68 84 74 80 78 C 76 82 70 80 65 82 C 60 84 56 90 50 90 C 44 90 40 84 35 82 C 30 80 24 82 20 78 C 16 74 16 68 14 63 C 12 58 6 54 6 48 C 6 42 12 38 14 33 C 16 28 16 22 20 18 C 24 14 30 16 35 14 C 40 12 44 6 50 6 Z',
  },
  {
    id: 'flower_5',
    name: '五瓣梅花',
    category: 'cute',
    pathD: 'M 50 26 C 54 12 68 6 78 14 C 88 22 86 38 74 46 C 88 48 94 62 88 74 C 82 86 66 86 58 76 C 54 90 38 94 28 84 C 18 74 22 58 34 52 C 20 46 18 30 28 20 C 38 10 50 18 50 26 Z',
  },
  // --- 符号气泡 ---
  {
    id: 'go',
    name: 'GO字母',
    category: 'symbol',
    pathD: 'M 10 10 L 45 10 L 45 32 L 25 32 L 25 68 L 45 68 L 45 45 L 35 45 L 35 32 L 45 32 L 45 90 L 10 90 Z M 55 10 C 78 10 90 20 90 50 C 90 80 78 90 55 90 C 35 90 35 90 55 90 Z M 55 25 C 70 25 75 35 75 50 C 75 65 70 75 55 75 Z',
  },
  {
    id: 'star',
    name: '圆角五角星',
    category: 'symbol',
    pathD: 'M 50 8 C 52 8 55 12 59 22 L 64 36 C 66 40 70 43 75 44 L 89 45 C 97 46 99 53 93 58 L 82 68 C 78 71 77 76 78 81 L 82 95 C 84 102 77 107 71 103 L 58 95 C 54 92 46 92 42 95 L 29 103 C 23 107 16 102 18 95 L 22 81 C 23 76 22 71 18 68 L 7 58 C 1 53 3 46 11 45 L 25 44 C 30 43 34 40 36 36 L 41 22 C 45 12 48 8 50 8 Z',
  },
  {
    id: 'heart',
    name: '浪漫爱心',
    category: 'symbol',
    pathD: 'M 50 88 C 22 68 4 52 4 32 C 4 16 16 6 32 6 C 40 6 46 10 50 16 C 54 10 60 6 68 6 C 84 6 96 16 96 32 C 96 52 78 68 50 88 Z',
  },
  {
    id: 'bubble_left',
    name: '对话气泡(左尖)',
    category: 'symbol',
    pathD: 'M 24 12 L 76 12 C 88 12 94 18 94 30 L 94 58 C 94 70 88 76 76 76 L 36 76 L 16 92 L 20 76 L 24 76 C 12 76 6 70 6 58 L 6 30 C 6 18 12 12 24 12 Z',
  },
  {
    id: 'bubble_right',
    name: '对话气泡(右尖)',
    category: 'symbol',
    pathD: 'M 24 12 L 76 12 C 88 12 94 18 94 30 L 94 58 C 94 70 88 76 76 76 L 80 76 L 84 92 L 64 76 L 24 76 C 12 76 6 70 6 58 L 6 30 C 6 18 12 12 24 12 Z',
  },
  {
    id: 'bubble_rect',
    name: '矩形对话框',
    category: 'symbol',
    pathD: 'M 10 16 L 90 16 C 94 16 96 18 96 22 L 96 68 C 96 72 94 74 90 74 L 32 74 L 18 88 L 22 74 L 10 74 C 6 74 4 72 4 68 L 4 22 C 4 18 6 16 10 16 Z',
  },
  {
    id: 'camera',
    name: '复古照相机',
    category: 'symbol',
    pathD: 'M 10 32 L 32 32 L 38 20 L 62 20 L 68 32 L 90 32 C 94 32 98 36 98 40 L 98 84 C 98 88 94 92 90 92 L 10 92 C 6 92 2 88 2 84 L 2 40 C 2 36 6 32 10 32 Z M 50 42 C 39 42 30 51 30 62 C 30 73 39 82 50 82 C 61 82 70 73 70 62 C 70 51 61 42 50 42 Z',
  },
  {
    id: 'notebook',
    name: '活页便签本',
    category: 'symbol',
    pathD: 'M 8 18 C 11 18 13 16 13 13 C 13 10 11 8 8 8 L 92 8 C 89 8 87 10 87 13 C 87 16 89 18 92 18 L 92 92 L 8 92 Z',
  },
  {
    id: 'ticket',
    name: '倒角票券',
    category: 'symbol',
    pathD: 'M 22 8 L 78 8 L 92 22 L 92 78 L 78 92 L 22 92 L 8 78 L 8 22 Z',
  },
  {
    id: 'saturn',
    name: '土星环行星',
    category: 'symbol',
    pathD: 'M 50 20 C 66 20 80 33 80 50 C 80 53 79 56 78 58 L 98 48 C 100 47 101 51 98 53 L 74 65 C 68 74 59 80 50 80 C 34 80 20 67 20 50 C 20 47 21 44 22 42 L 2 52 C 0 53 -1 49 2 47 L 26 35 C 32 26 41 20 50 20 Z',
  },
  {
    id: 'grid_3x3',
    name: '九宫格切片',
    category: 'symbol',
    pathD: 'M 6 6 L 32 6 L 32 32 L 6 32 Z M 38 6 L 64 6 L 64 32 L 38 32 Z M 70 6 L 94 6 L 94 32 L 70 32 Z M 6 38 L 32 38 L 32 64 L 6 64 Z M 38 38 L 64 38 L 64 64 L 38 64 Z M 70 38 L 94 38 L 94 64 L 70 64 Z M 6 70 L 32 70 L 32 94 L 6 94 Z M 38 70 L 64 70 L 64 94 L 38 94 Z M 70 70 L 94 70 L 94 94 L 70 94 Z',
  },
  // --- 复古花边 ---
  {
    id: 'lace_crown',
    name: '欧式复古皇冠顶',
    category: 'vintage',
    pathD: 'M 6 94 L 6 52 C 16 52 24 44 32 50 C 40 40 60 40 68 50 C 76 44 84 52 94 52 L 94 94 Z',
  },
  {
    id: 'lace_bottom',
    name: '欧式复古蕾丝底',
    category: 'vintage',
    pathD: 'M 6 6 L 94 6 L 94 48 C 84 48 76 56 68 50 C 60 60 40 60 32 50 C 24 56 16 48 6 48 Z',
  },
  {
    id: 'corner_arc',
    name: '右上大圆弧',
    category: 'vintage',
    pathD: 'M 6 94 L 6 6 L 40 6 C 72 6 94 28 94 60 L 94 94 Z',
  },
];

/**
 * 全局全局隐式 SVG ClipPath 容器组件
 * 自动为每一个 Mask 生成带 clipPathUnits="objectBoundingBox" 的精准矢量剪裁路径
 */
export const MomoGlobalClipPaths: React.FC = () => {
  return (
    <svg
      width="0"
      height="0"
      className="absolute pointer-events-none opacity-0 overflow-hidden"
      style={{ position: 'absolute', width: 0, height: 0, left: -9999, top: -9999 }}
      aria-hidden="true"
    >
      <defs>
        {MOMO_MASK_DEFINITIONS.map((m) => {
          if (!m.pathD || m.isNone) return null;
          const unitPath = convertPathToUnitBoundingBox(m.pathD);
          return (
            <clipPath key={m.id} id={`momo-clip-${m.id}`} clipPathUnits="objectBoundingBox">
              <path d={unitPath} />
            </clipPath>
          );
        })}
      </defs>
    </svg>
  );
};

/**
 * 统一获取元素的 clipPath CSS 属性
 */
export const getMomoMaskStyle = (maskShape?: string): React.CSSProperties => {
  if (!maskShape || maskShape === 'none') return {};
  const found = MOMO_MASK_DEFINITIONS.find((m) => m.id === maskShape);
  if (!found || found.isNone) return {};
  if (found.cssClipPath) {
    return { clipPath: found.cssClipPath };
  }
  return {
    clipPath: `url(#momo-clip-${maskShape})`,
  };
};
