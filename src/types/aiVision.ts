/**
 * 厂商中立的统一 AI 视觉分析与智能配本接口体系 (AI Vision & Auto-Layout Interfaces)
 * 
 * 核心设计原则：
 * 1. 厂商中立性 (Vendor-Agnostic): 完全解耦 Gemini / 阿里通义千问 Qwen / 百度文心 / 腾讯混元等具体视觉模型提供商
 * 2. 统一结构化协议 (Unified Schema): 仅输入标准化 Asset 资产与参数，仅输出标准化分析结果
 * 3. 渐进式流式管道 (Progressive Pipeline):
 *    照片Asset -> AI Vision Analyzer -> 统一JSON分析结果 -> 照片分类/评分/分组 -> 故事章节划分 -> 排版引擎 -> 跨页Spread
 */

/**
 * 场景分类大类定义
 */
export type PhotoSceneCategory =
  | 'portrait'      // 人物写真 / 自拍 / 单人
  | 'group_photo'  // 合影 / 聚会 / 团体
  | 'landscape'    // 自然风景 / 山川湖海 / 日出日落
  | 'cityscape'    // 城市风光 / 建筑 / 街道
  | 'food'         // 美食 / 餐饮 / 咖啡
  | 'travel'       // 旅行打卡 / 景点 / 交通
  | 'event'        // 婚礼 / 生日 / 毕业 / 庆典
  | 'pet'          // 宠物 / 动物
  | 'night'        // 夜景 / 烟花 / 星空
  | 'document'     // 文档 / 票据 / 静态微距
  | 'other';

/**
 * 照片构图横竖比例类型
 */
export type PhotoOrientationType = 'horizontal' | 'vertical' | 'square' | 'panoramic';

/**
 * 照片主体视觉焦点与人脸检测
 */
export interface DetectedFace {
  id: string;
  box: {
    x: number;      // 归一化坐标 0-1
    y: number;
    width: number;
    height: number;
  };
  genderHint?: 'male' | 'female' | 'child' | 'unknown';
  expression?: 'smile' | 'neutral' | 'happy' | 'other';
}

/**
 * 单张照片的统一 AI 视觉结构化分析结果 (Photo Analysis Result)
 */
export interface PhotoAnalysisResult {
  assetId: string;
  analyzedAt: number;
  provider: string; // 标识由哪个 Provider 完成 (例如 "qwen-vl-max", "gemini-1.5-flash", "mock_local")

  // 1. 内容与场景识别
  caption?: string;                  // 一句话场景总结 (如 "洱海边情侣夕阳逆光合影")
  tags: string[];                    // 标签库 (如 ["海边", "黄昏", "情侣", "逆光", "浪漫"])
  category: PhotoSceneCategory;      // 主场景类别
  secondaryCategories?: string[];    // 次要分类

  // 2. 地点与环境
  locationHint?: string;             // 识别出的地理/景点名称 (如 "云南·大理·双廊")
  timePeriodHint?: 'morning' | 'noon' | 'sunset' | 'night' | 'indoor' | 'outdoor';

  // 3. 构图与视觉特征
  orientation: PhotoOrientationType; // 智能构图判断
  aspectRatio: number;               // 宽高比 (width / height)
  dominantColors?: string[];         // 主色调 HEX 数组 (如 ["#e29b68", "#2c3e50"])
  facesCount: number;                // 识别到的人物/人脸数量
  detectedFaces?: DetectedFace[];    // 人脸或焦点包围盒

  // 4. 质量评估与推荐打分 (0.0 - 100.0)
  qualityScore: number;              // 画面清晰度/曝光质量评分 (100分制)
  compositionScore: number;          // 美学构图评分
  isBlurry?: boolean;                // 是否存在模糊/抖动
  isDuplicateOrSimilar?: boolean;    // 是否为连拍相似废片
  similarGroupId?: string;           // 相似图片聚类组 ID
  isHighlightCandidate?: boolean;    // 是否适合作为大片跨页/封面主图候选
}

/**
 * 智能相册分组与故事章节模型 (Story Cluster & Chapter)
 */
export interface PhotoStoryChapter {
  id: string;
  chapterIndex: number;
  title: string;                     // 章节标题 (如 "第一章：启程与沿途风光", "第二章：双廊的慢时光")
  subtitle?: string;
  description?: string;
  dateRangeText?: string;            // 如 "2026.08.10 - 2026.08.12"
  locationText?: string;             // 如 "云南·大理"
  assignedAssetIds: string[];        // 归属到该章节的照片 AssetId 列表
  coverAssetId?: string;             // 章节封面主视觉 AssetId
  recommendedTheme?: 'travel' | 'wedding' | 'childhood' | 'minimal' | 'family';
}

/**
 * AI 排版规划方案 (Auto-Layout Plan)
 */
export interface AutoLayoutPlan {
  planId: string;
  createdAt: number;
  provider: string;
  productSpecId: string;             // 适配的商品物理规格
  targetSpreadCount: number;         // 目标跨页数
  chapters: PhotoStoryChapter[];     // 故事章节编排
  totalPhotosUsed: number;           // 规划使用的照片数量
  summaryDescription: string;        // 规划简述 (如 "根据 68 张大理旅行照片，智能生成 20 页故事相册")
}

/**
 * 厂商中立的视觉分析器抽象接口 (Vision Analyzer Interface)
 * 未来接入 Gemini / 阿里百炼 Qwen / 腾讯混元 / 自建视觉网关 时只需实现该接口
 */
export interface VisionAnalyzer {
  readonly providerName: string;

  /**
   * 批量分析照片资产
   */
  analyzeBatch(
    photos: { assetId: string; url: string; naturalWidth?: number; naturalHeight?: number }[],
    options?: {
      detectFaces?: boolean;
      detectLocation?: boolean;
      detectQuality?: boolean;
    }
  ): Promise<PhotoAnalysisResult[]>;

  /**
   * 基于分析结果智能聚类与章节编排
   */
  generateStoryChapters(
    analyses: PhotoAnalysisResult[],
    params: {
      albumTheme?: string;
      targetPageCount?: number;
      preferHighQualityFirst?: boolean;
    }
  ): Promise<PhotoStoryChapter[]>;
}
