/**
 * 米莫标准精选素材（图章/贴纸/印章）两级分类库
 * 一级分类：宝宝、旅行、爱情、毕业、婚礼、家庭、简约
 * 二级主题：新年篇章、宝宝生日、生日派对、飞行员、明星宝宝、游乐场、彩色的一年、天使宝宝、幸运星、快乐圣诞、成长记录、实力偶像、逸致古风、大眼睛日记、粉色少女心、灵感碎片、周岁纪念、平安颂歌、笑颜日和等
 * 未来在模板后台（CMS）可直接根据此数据结构由设计师录入、上传和发布
 */

export interface StampSubcategory {
  id: string;
  name: string;
}

export interface StampCategory {
  id: string;
  name: string;
  subcategories: StampSubcategory[];
}

export interface PresetStamp {
  id: string;
  name: string;
  category: string; // 一级分类 ID
  subcategory?: string; // 二级主题 ID
  svgContent: string; // 高清矢量 SVG 字符串 (或 DataURL / PNG URL)
  defaultWidthPercent: number; // 默认在页面占宽百分比
  defaultHeightPercent: number;
}

// 米莫官方标准一级与二级分类结构
export const MIMO_STAMP_CATEGORIES: StampCategory[] = [
  {
    id: 'baby',
    name: '宝宝',
    subcategories: [
      { id: 'baby_birthday', name: '宝宝生日' },
      { id: 'baby_growth', name: '成长记录' },
      { id: 'baby_party', name: '生日派对' },
      { id: 'baby_pilot', name: '飞行员' },
      { id: 'baby_star', name: '明星宝宝' },
      { id: 'baby_park', name: '游乐场' },
      { id: 'baby_color_year', name: '彩色的一年' },
      { id: 'baby_angel', name: '天使宝宝' },
      { id: 'baby_lucky_star', name: '幸运星' },
      { id: 'baby_christmas', name: '快乐圣诞' },
      { id: 'baby_pink_girl', name: '粉色少女心' },
      { id: 'baby_one_year', name: '周岁纪念' },
      { id: 'baby_smile', name: '笑颜日和' },
    ],
  },
  {
    id: 'travel',
    name: '旅行',
    subcategories: [
      { id: 'travel_footprint', name: '足迹与地图' },
      { id: 'travel_passport', name: '海关邮戳' },
      { id: 'travel_scenery', name: '山川湖海' },
      { id: 'travel_city_walk', name: 'City Walk 漫游' },
      { id: 'travel_holiday', name: '度假好心情' },
    ],
  },
  {
    id: 'love',
    name: '爱情',
    subcategories: [
      { id: 'love_sweet_day', name: '甜蜜日常' },
      { id: 'love_anniversary', name: '恋爱纪念日' },
      { id: 'love_heartbeat', name: '怦然心动' },
      { id: 'love_confession', name: '深情告白' },
    ],
  },
  {
    id: 'graduation',
    name: '毕业',
    subcategories: [
      { id: 'grad_youth', name: '青春不散场' },
      { id: 'grad_future', name: '奔赴山海' },
      { id: 'grad_memories', name: '同窗岁月' },
    ],
  },
  {
    id: 'wedding',
    name: '婚礼',
    subcategories: [
      { id: 'wedding_we_said_yes', name: '誓言之约' },
      { id: 'wedding_invitation', name: '浪漫花体' },
      { id: 'wedding_wax_seal', name: '复古火漆' },
    ],
  },
  {
    id: 'family',
    name: '家庭',
    subcategories: [
      { id: 'family_warm_time', name: '温馨时光' },
      { id: 'family_delicious_food', name: '家常烟火' },
      { id: 'family_weekend', name: '周末露营' },
    ],
  },
  {
    id: 'minimalist',
    name: '简约',
    subcategories: [
      { id: 'minimal_typography', name: '经典英文' },
      { id: 'minimal_retro_frame', name: '双线框与几何' },
      { id: 'minimal_daily_label', name: '手账标签' },
    ],
  },
];

export const PRESET_STAMPS: PresetStamp[] = [
  // ================= 1. 宝宝 (Baby) =================
  {
    id: 'stamp_baby_1st_bday',
    name: '1ST BIRTHDAY 周岁抓周',
    category: 'baby',
    subcategory: 'baby_one_year',
    defaultWidthPercent: 22,
    defaultHeightPercent: 22,
    svgContent: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="90" fill="none" stroke="#f43f5e" stroke-width="4" stroke-dasharray="6,4"/>
      <circle cx="100" cy="100" r="80" fill="#fff1f2" stroke="#f43f5e" stroke-width="1.5"/>
      <text x="100" y="55" fill="#e11d48" font-size="14" font-family="sans-serif" font-weight="900" text-anchor="middle" letter-spacing="3">HAPPY 1ST</text>
      <text x="100" y="115" fill="#be123c" font-size="52" font-family="serif" font-weight="bold" text-anchor="middle">1</text>
      <text x="100" y="145" fill="#e11d48" font-size="15" font-family="sans-serif" font-weight="bold" text-anchor="middle" letter-spacing="2">BIRTHDAY</text>
      <text x="100" y="165" fill="#9f1239" font-size="10" font-family="sans-serif" text-anchor="middle">★ SWEET BABY ★</text>
    </svg>`,
  },
  {
    id: 'stamp_baby_angel',
    name: 'LITTLE ANGEL 天使降临',
    category: 'baby',
    subcategory: 'baby_angel',
    defaultWidthPercent: 24,
    defaultHeightPercent: 18,
    svgContent: `<svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="110" cy="75" rx="100" ry="65" fill="#fefce8" stroke="#ca8a04" stroke-width="3"/>
      <ellipse cx="110" cy="75" rx="92" ry="57" fill="none" stroke="#ca8a04" stroke-width="1" stroke-dasharray="4,3"/>
      <path d="M 70,45 Q 90,30 110,40 Q 130,30 150,45" fill="none" stroke="#eab308" stroke-width="3" stroke-linecap="round"/>
      <text x="110" y="78" fill="#854d0e" font-size="20" font-family="serif" font-weight="bold" font-style="italic" text-anchor="middle">Little Angel</text>
      <text x="110" y="105" fill="#a16207" font-size="12" font-family="sans-serif" font-weight="bold" letter-spacing="4" text-anchor="middle">SWEET HEART</text>
    </svg>`,
  },
  {
    id: 'stamp_baby_growth',
    name: 'GROWTH LOG 成长里程碑',
    category: 'baby',
    subcategory: 'baby_growth',
    defaultWidthPercent: 22,
    defaultHeightPercent: 22,
    svgContent: `<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
      <circle cx="90" cy="90" r="82" fill="#eff6ff" stroke="#2563eb" stroke-width="3"/>
      <circle cx="90" cy="90" r="74" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="5,4"/>
      <path d="M 60,70 L 90,40 L 120,70 L 105,70 L 105,110 L 75,110 L 75,70 Z" fill="#3b82f6"/>
      <text x="90" y="135" fill="#1d4ed8" font-size="14" font-family="sans-serif" font-weight="900" text-anchor="middle" letter-spacing="2">GROWING UP</text>
      <text x="90" y="155" fill="#2563eb" font-size="10" font-family="monospace" text-anchor="middle">DAY BY DAY</text>
    </svg>`,
  },
  {
    id: 'stamp_baby_pink_smile',
    name: 'SMILE DAY 笑颜日和',
    category: 'baby',
    subcategory: 'baby_smile',
    defaultWidthPercent: 20,
    defaultHeightPercent: 20,
    svgContent: `<svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
      <circle cx="90" cy="90" r="80" fill="#fdf2f8" stroke="#db2777" stroke-width="3"/>
      <circle cx="65" cy="75" r="8" fill="#db2777"/>
      <circle cx="115" cy="75" r="8" fill="#db2777"/>
      <path d="M 60,105 Q 90,140 120,105" fill="none" stroke="#db2777" stroke-width="5" stroke-linecap="round"/>
      <text x="90" y="155" fill="#be185d" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle" letter-spacing="3">SMILE BABY</text>
    </svg>`,
  },

  // ================= 2. 旅行 (Travel) =================
  {
    id: 'stamp_travel_explore',
    name: 'EXPLORE 世界探索',
    category: 'travel',
    subcategory: 'travel_footprint',
    defaultWidthPercent: 22,
    defaultHeightPercent: 22,
    svgContent: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="92" fill="none" stroke="#76383d" stroke-width="4" stroke-dasharray="6,4"/>
      <circle cx="100" cy="100" r="82" fill="none" stroke="#76383d" stroke-width="2"/>
      <path id="circlePath1" d="M 28,100 A 72,72 0 0,1 172,100" fill="none"/>
      <text fill="#76383d" font-size="16" font-family="serif" font-weight="bold" letter-spacing="3">
        <textPath href="#circlePath1" startOffset="50%" text-anchor="middle">★ WANDERLUST ★</textPath>
      </text>
      <circle cx="100" cy="100" r="46" fill="none" stroke="#76383d" stroke-width="2"/>
      <polygon points="100,68 107,93 132,100 107,107 100,132 93,107 68,100 93,93" fill="#76383d"/>
      <text x="100" y="162" fill="#76383d" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle" letter-spacing="4">EXPLORE</text>
    </svg>`,
  },
  {
    id: 'stamp_travel_passport',
    name: 'PASSPORT 航空邮戳',
    category: 'travel',
    subcategory: 'travel_passport',
    defaultWidthPercent: 26,
    defaultHeightPercent: 18,
    svgContent: `<svg viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="224" height="144" rx="20" fill="none" stroke="#1e3a8a" stroke-width="4"/>
      <rect x="14" y="14" width="212" height="132" rx="15" fill="none" stroke="#1e3a8a" stroke-width="1.5" stroke-dasharray="4,3"/>
      <text x="120" y="45" fill="#1e3a8a" font-size="16" font-family="sans-serif" font-weight="900" text-anchor="middle" letter-spacing="5">INTERNATIONAL</text>
      <line x1="30" y1="56" x2="210" y2="56" stroke="#1e3a8a" stroke-width="2"/>
      <path d="M 65,95 L 85,85 L 105,95 L 98,82 L 115,70 L 93,70 L 85,55 L 77,70 L 55,70 L 72,82 Z" fill="#1e3a8a" transform="translate(35, 12) scale(0.6)"/>
      <text x="120" y="90" fill="#1e3a8a" font-size="22" font-family="monospace" font-weight="bold" text-anchor="middle">AIRPORT ENTRY</text>
      <line x1="30" y1="104" x2="210" y2="104" stroke="#1e3a8a" stroke-width="2"/>
      <text x="120" y="132" fill="#1e3a8a" font-size="14" font-family="sans-serif" font-weight="bold" text-anchor="middle" letter-spacing="3">PASSED / IMMIGRATION</text>
    </svg>`,
  },
  {
    id: 'stamp_travel_journey',
    name: 'BON VOYAGE 旅途启程',
    category: 'travel',
    subcategory: 'travel_holiday',
    defaultWidthPercent: 22,
    defaultHeightPercent: 22,
    svgContent: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="90" fill="none" stroke="#c5a880" stroke-width="4"/>
      <circle cx="100" cy="100" r="82" fill="none" stroke="#c5a880" stroke-width="1.5"/>
      <path d="M 50,115 C 80,75 120,75 150,115" fill="none" stroke="#c5a880" stroke-width="3"/>
      <path d="M 85,85 L 100,60 L 115,85 Z" fill="#c5a880"/>
      <text x="100" y="145" fill="#c5a880" font-size="15" font-family="serif" font-weight="bold" text-anchor="middle" letter-spacing="3">BON VOYAGE</text>
      <text x="100" y="165" fill="#c5a880" font-size="10" font-family="sans-serif" text-anchor="middle" letter-spacing="2">HAVE A NICE TRIP</text>
    </svg>`,
  },

  // ================= 3. 爱情 (Love) =================
  {
    id: 'stamp_love_sweet',
    name: 'LOVE YOU MORE 甜蜜誓言',
    category: 'love',
    subcategory: 'love_sweet_day',
    defaultWidthPercent: 24,
    defaultHeightPercent: 18,
    svgContent: `<svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="204" height="134" rx="16" fill="#fff1f2" stroke="#e11d48" stroke-width="3"/>
      <path d="M 95,45 C 95,35 105,35 110,42 C 115,35 125,35 125,45 C 125,58 110,68 110,68 C 110,68 95,58 95,45 Z" fill="#e11d48"/>
      <text x="110" y="92" fill="#be123c" font-size="22" font-family="serif" font-weight="bold" font-style="italic" text-anchor="middle">Love You More</text>
      <text x="110" y="118" fill="#e11d48" font-size="11" font-family="sans-serif" font-weight="bold" letter-spacing="4" text-anchor="middle">EVERY SINGLE DAY</text>
    </svg>`,
  },
  {
    id: 'stamp_love_anniversary',
    name: 'OUR ANNIVERSARY 纪念日',
    category: 'love',
    subcategory: 'love_anniversary',
    defaultWidthPercent: 22,
    defaultHeightPercent: 22,
    svgContent: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="90" fill="none" stroke="#be123c" stroke-width="3"/>
      <circle cx="100" cy="100" r="82" fill="none" stroke="#be123c" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="100" y="65" fill="#be123c" font-size="12" font-family="sans-serif" font-weight="bold" letter-spacing="4" text-anchor="middle">★ TOGETHER ★</text>
      <text x="100" y="105" fill="#9f1239" font-size="20" font-family="serif" font-weight="bold" font-style="italic" text-anchor="middle">Anniversary</text>
      <line x1="45" y1="118" x2="155" y2="118" stroke="#be123c" stroke-width="1.5"/>
      <text x="100" y="145" fill="#be123c" font-size="13" font-family="sans-serif" font-weight="bold" letter-spacing="3" text-anchor="middle">FOREVER & ALWAYS</text>
    </svg>`,
  },

  // ================= 4. 毕业 (Graduation) =================
  {
    id: 'stamp_grad_youth',
    name: 'GRADUATION 奔赴山海',
    category: 'graduation',
    subcategory: 'grad_youth',
    defaultWidthPercent: 24,
    defaultHeightPercent: 18,
    svgContent: `<svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg">
      <polygon points="110,25 185,55 110,85 35,55" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
      <path d="M 60,65 L 60,105 Q 110,135 160,105 L 160,65" fill="none" stroke="#1e293b" stroke-width="3"/>
      <line x1="170" y1="58" x2="185" y2="105" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
      <text x="110" y="112" fill="#0f172a" font-size="18" font-family="sans-serif" font-weight="900" letter-spacing="3" text-anchor="middle">GRADUATION</text>
      <text x="110" y="132" fill="#475569" font-size="10" font-family="sans-serif" letter-spacing="4" text-anchor="middle">CLASS OF MEMORIES</text>
    </svg>`,
  },

  // ================= 5. 婚礼 (Wedding) =================
  {
    id: 'stamp_wedding_seal',
    name: 'WAX SEAL 欧式火漆印',
    category: 'wedding',
    subcategory: 'wedding_wax_seal',
    defaultWidthPercent: 20,
    defaultHeightPercent: 20,
    svgContent: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M 100,10 C 130,8 160,20 180,45 C 200,75 195,115 180,145 C 160,180 120,195 90,190 C 55,185 20,165 10,130 C 0,95 15,55 45,30 C 65,15 80,12 100,10 Z" fill="#881337" opacity="0.95"/>
      <circle cx="100" cy="100" r="68" fill="none" stroke="#fecdd3" stroke-width="2.5" stroke-dasharray="5,3"/>
      <text x="100" y="112" fill="#fff" font-size="36" font-family="serif" font-weight="bold" font-style="italic" text-anchor="middle">M</text>
      <path d="M 70,135 Q 100,145 130,135" fill="none" stroke="#fecdd3" stroke-width="2"/>
    </svg>`,
  },
  {
    id: 'stamp_wedding_we_said_yes',
    name: 'WE SAID YES 唯美誓约',
    category: 'wedding',
    subcategory: 'wedding_we_said_yes',
    defaultWidthPercent: 24,
    defaultHeightPercent: 16,
    svgContent: `<svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="208" height="128" rx="8" fill="none" stroke="#76383d" stroke-width="2.5"/>
      <rect x="12" y="12" width="196" height="116" rx="4" fill="none" stroke="#76383d" stroke-width="1" stroke-dasharray="4,3"/>
      <text x="110" y="52" fill="#76383d" font-size="13" font-family="serif" font-style="italic" text-anchor="middle">two hearts become one</text>
      <text x="110" y="85" fill="#76383d" font-size="24" font-family="serif" font-weight="bold" letter-spacing="3" text-anchor="middle">WE SAID YES</text>
      <text x="110" y="108" fill="#76383d" font-size="10" font-family="sans-serif" letter-spacing="5" text-anchor="middle">PERFECT MOMENT</text>
    </svg>`,
  },

  // ================= 6. 家庭 (Family) =================
  {
    id: 'stamp_family_warm_time',
    name: 'FAMILY TIME 阖家温馨',
    category: 'family',
    subcategory: 'family_warm_time',
    defaultWidthPercent: 22,
    defaultHeightPercent: 22,
    svgContent: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="90" fill="#fef3c7" stroke="#d97706" stroke-width="4"/>
      <circle cx="100" cy="100" r="80" fill="none" stroke="#d97706" stroke-width="1.5" stroke-dasharray="5,4"/>
      <text x="100" y="65" fill="#b45309" font-size="12" font-family="sans-serif" font-weight="900" letter-spacing="3" text-anchor="middle">★ SWEET HOME ★</text>
      <text x="100" y="105" fill="#78350f" font-size="22" font-family="serif" font-weight="bold" font-style="italic" text-anchor="middle">Family Time</text>
      <line x1="45" y1="120" x2="155" y2="120" stroke="#d97706" stroke-width="2"/>
      <text x="100" y="148" fill="#b45309" font-size="12" font-family="sans-serif" font-weight="bold" letter-spacing="3" text-anchor="middle">FULL OF LOVE</text>
    </svg>`,
  },

  // ================= 7. 简约 (Minimalist) =================
  {
    id: 'stamp_vintage_special_day',
    name: 'SPECIAL DAY 独家记忆',
    category: 'minimalist',
    subcategory: 'minimal_retro_frame',
    defaultWidthPercent: 24,
    defaultHeightPercent: 16,
    svgContent: `<svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="208" height="128" rx="8" fill="none" stroke="#262626" stroke-width="3"/>
      <line x1="16" y1="16" x2="204" y2="16" stroke="#262626" stroke-width="1"/>
      <line x1="16" y1="124" x2="204" y2="124" stroke="#262626" stroke-width="1"/>
      <text x="110" y="52" fill="#262626" font-size="14" font-family="serif" font-style="italic" text-anchor="middle">memories of</text>
      <text x="110" y="85" fill="#262626" font-size="24" font-family="serif" font-weight="bold" letter-spacing="3" text-anchor="middle">SPECIAL DAY</text>
      <text x="110" y="108" fill="#262626" font-size="10" font-family="sans-serif" letter-spacing="5" text-anchor="middle">COLLECTION</text>
    </svg>`,
  },
  {
    id: 'stamp_vintage_camera',
    name: 'CAMERA 胶卷相机',
    category: 'minimalist',
    subcategory: 'minimal_daily_label',
    defaultWidthPercent: 20,
    defaultHeightPercent: 20,
    svgContent: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="90" fill="none" stroke="#76383d" stroke-width="3"/>
      <rect x="45" y="70" width="110" height="70" rx="10" fill="none" stroke="#76383d" stroke-width="4"/>
      <rect x="80" y="55" width="40" height="15" rx="3" fill="#76383d"/>
      <circle cx="100" cy="105" r="24" fill="none" stroke="#76383d" stroke-width="4"/>
      <circle cx="100" cy="105" r="12" fill="#76383d"/>
      <circle cx="135" cy="85" r="5" fill="#76383d"/>
      <text x="100" y="170" fill="#76383d" font-size="12" font-family="serif" font-weight="bold" text-anchor="middle" letter-spacing="2">PHOTO MOMENT</text>
    </svg>`,
  },
];

/**
 * 将 SVG 字符串转换为可在 img src 中直接使用的 Data URL
 */
export function svgToDataUrl(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}
