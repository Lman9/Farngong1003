/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// MetaDotHK/openrice-scraper Engine Integration (OpenRice v2 Search JSON + CLI)
// ============================================================================

const OPENRICE_API = 'https://www.openrice.com/api/v2/search';
const OPENRICE_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const STATUS_OPEN = 10;

// OpenRice priceRangeId mapping (verified in MetaDotHK/openrice-scraper)
const PRICE_BANDS: Record<
  number,
  { bandYue: string; bandEn: string; min: number; max: number; bracketId: string }
> = {
  1: { bandYue: '$50以下', bandEn: 'Below $50', min: 0, max: 50, bracketId: 'under-50' },
  2: { bandYue: '$51-100', bandEn: '$51-100', min: 51, max: 100, bracketId: '51-100' },
  3: { bandYue: '$101-200', bandEn: '$101-200', min: 101, max: 200, bracketId: '101-200' },
  4: { bandYue: '$201-400', bandEn: '$201-400', min: 201, max: 400, bracketId: '201-plus' },
  5: { bandYue: '$401-800', bandEn: '$401-800', min: 401, max: 800, bracketId: '201-plus' },
  6: { bandYue: '$801以上', bandEn: 'Above $801', min: 801, max: 1200, bracketId: '201-plus' },
};

// Comprehensive mapping of Hong Kong 18 Administrative Districts & Single Sub-Districts
export const HK_DISTRICT_TO_OPENRICE_IDS: Record<string, number[]> = {
  // --- 18 Administrative Districts ---
  'central-western': [1003, 1011, 1001, 1008, 1002, 1005],
  'wan-chai': [1022, 1019, 1026, 1025, 1017],
  eastern: [1004, 1014, 1023, 1024, 1018, 1013, 1009],
  southern: [1027, 1012, 1020, 1010, 1016, 1021],
  'yau-tsim-mong': [2008, 2028, 2011, 2010, 2029, 2005],
  'sham-shui-po': [2019, 2013, 2016, 2031, 2007],
  'kowloon-city': [2001, 2015, 2004, 2002, 2009],
  'wong-tai-sin': [2020, 2022, 2027, 2030, 2021, 2032],
  'kwun-tong': [2026, 2003, 2006, 2024, 2012],
  'kwai-tsing': [3015, 3019, 3017],
  'tsuen-wan': [3018, 3010],
  'tuen-mun': [3005],
  'yuen-long': [3003, 3004],
  north: [3001, 3008],
  'tai-po': [3002, 3014],
  'sha-tin': [3007, 3012, 3009, 3013],
  'sai-kung': [3020, 3006],
  islands: [4009, 4004, 4001, 4002, 4003, 4999],

  // --- Single Sub-Districts (Each region separated, e.g. 天后 and 大坑 separated) ---
  // 灣仔區
  'tin-hau': [1026], // 天后
  'tai-hang': [1025], // 大坑
  'causeway-bay': [1019], // 銅鑼灣
  'happy-valley': [1017], // 跑馬地
  wan_chai_single: [1022], // 灣仔

  // 中西區
  central: [1003], // 中環
  admiralty: [1011], // 金鐘
  'sheung-wan': [1001], // 上環
  'sai-ying-pun': [1008], // 西營盤 / 西環
  'kennedy-town': [1002], // 堅尼地城
  'mid-levels': [1005], // 半山 / 山頂
  western: [1008, 1002],

  // 東區
  'north-point': [1004], // 北角
  'fortress-hill': [1004], // 炮台山
  'quarry-bay': [1014], // 鰂魚涌
  'tai-koo': [1023], // 太古
  'sai-wan-ho': [1024], // 西灣河
  'shau-kei-wan': [1018], // 筲箕灣
  'chai-wan': [1013], // 柴灣

  // 南區
  'wong-chuk-hang': [1027], // 黃竹坑
  aberdeen: [1012], // 香港仔
  'ap-lei-chau': [1020], // 鴨脷洲
  stanley: [1010], // 赤柱
  'repulse-bay': [1016], // 淺水灣

  // 油尖旺區
  'tsim-sha-tsui': [2008], // 尖沙咀
  jordan: [2028], // 佐敦
  'yau-ma-tei': [2011], // 油麻地
  'mong-kok': [2010], // 旺角
  'prince-edward': [2029], // 太子
  'tai-kok-tsui': [2005], // 大角咀

  // 深水埗區
  'cheung-sha-wan': [2013], // 長沙灣
  'lai-chi-kok': [2016], // 荔枝角
  'mei-foo': [2031], // 美孚
  'shek-kip-mei': [2007], // 石硤尾

  // 九龍城區
  'hung-hom': [2015], // 紅磡
  'to-kwa-wan': [2004], // 土瓜灣
  'kowloon-tong': [2002], // 九龍塘
  'ho-man-tin': [2009], // 何文田

  // 黃大仙區
  'san-po-kong': [2022], // 新蒲崗
  'diamond-hill': [2027], // 鑽石山
  'lok-fu': [2030], // 樂富
  'tsz-wan-shan': [2021, 2032], // 慈雲山 / 彩虹

  // 觀塘區
  'kowloon-bay': [2003], // 九龍灣
  'ngau-tau-kok': [2006], // 牛頭角
  'lam-tin': [2024], // 藍田
  'yau-tong': [2012], // 油塘

  // 西貢區 (將軍澳各小區與西貢市中心獨立分割)
  tko: [3020], // 將軍澳
  'hang-hau': [3020], // 坑口
  'po-lam': [3020], // 寶琳
  'tiu-keng-leng': [3020], // 調景嶺
  'lohas-park': [3020], // 康城
  'sai-kung-town': [3006], // 西貢市中心

  // 沙田區
  'tai-wai': [3012], // 大圍
  'ma-on-shan': [3009], // 馬鞍山
  'fo-tan': [3013], // 火炭
  'shek-mun': [3007], // 石門
  'sha-tin-centre': [3007], // 沙田市中心

  // 大埔區
  'tai-po-market': [3002], // 大埔墟
  'tai-po-centre': [3002], // 大埔中心
  'tai-wo': [3014], // 太和
  'science-park': [3002], // 科學園

  // 北區
  'sheung-shui': [3001], // 上水
  fanling: [3008], // 粉嶺
  'luen-wo-hui': [3008], // 聯和墟

  // 荃灣區
  'lo-tak-court': [3018], // 路德圍
  'sham-tseng': [3010], // 深井
  'tsuen-wan-centre': [3018], // 荃灣市中心

  // 葵青區
  'kwai-fong': [3015], // 葵芳
  'kwai-chung': [3019], // 葵涌
  'tsing-yi': [3017], // 青衣

  // 屯門區
  'tuen-mun-centre': [3005], // 屯門市中心
  'san-hui': [3005], // 新墟
  'hung-kiu': [3005], // 紅橋
  'gold-coast': [3005], // 黃金海岸

  // 元朗區
  'yuen-long-centre': [3003], // 元朗市中心
  'kau-yuk-road': [3003], // 教育路
  'tin-shui-wai': [3004], // 天水圍

  // 離島區
  'tung-chung': [4009], // 東涌
  'cheung-chau': [4004], // 長洲
  lantau: [4001], // 大嶼山
  'lamma-island': [4002], // 南丫島
  'discovery-bay': [4003], // 愉景灣
};

// Reverse lookup from OpenRice districtId to primary sub-region code
const PRIMARY_SUBREGION_CODES = Object.keys(HK_DISTRICT_TO_OPENRICE_IDS);

const OPENRICE_ID_TO_HK_DISTRICT: Record<number, string> = {
  1026: 'tin-hau',
  1025: 'tai-hang',
  1019: 'causeway-bay',
  1017: 'happy-valley',
  1022: 'wan-chai',
  1003: 'central',
  1011: 'admiralty',
  1001: 'sheung-wan',
  1008: 'sai-ying-pun',
  1002: 'kennedy-town',
  1005: 'mid-levels',
  1004: 'north-point',
  1014: 'quarry-bay',
  1023: 'tai-koo',
  1024: 'sai-wan-ho',
  1018: 'shau-kei-wan',
  1013: 'chai-wan',
  1027: 'wong-chuk-hang',
  1012: 'aberdeen',
  1020: 'ap-lei-chau',
  1010: 'stanley',
  1016: 'repulse-bay',
  2008: 'tsim-sha-tsui',
  2028: 'jordan',
  2011: 'yau-ma-tei',
  2010: 'mong-kok',
  2029: 'prince-edward',
  2005: 'tai-kok-tsui',
  2019: 'sham-shui-po',
  2013: 'cheung-sha-wan',
  2016: 'lai-chi-kok',
  2031: 'mei-foo',
  2007: 'shek-kip-mei',
  2001: 'kowloon-city',
  2015: 'hung-hom',
  2004: 'to-kwa-wan',
  2002: 'kowloon-tong',
  2009: 'ho-man-tin',
  2020: 'wong-tai-sin',
  2022: 'san-po-kong',
  2027: 'diamond-hill',
  2030: 'lok-fu',
  2021: 'tsz-wan-shan',
  2026: 'kwun-tong',
  2003: 'kowloon-bay',
  2006: 'ngau-tau-kok',
  2024: 'lam-tin',
  2012: 'yau-tong',
  3015: 'kwai-fong',
  3019: 'kwai-chung',
  3017: 'tsing-yi',
  3018: 'tsuen-wan',
  3010: 'sham-tseng',
  3005: 'tuen-mun',
  3003: 'yuen-long',
  3004: 'tin-shui-wai',
  3001: 'sheung-shui',
  3008: 'fanling',
  3002: 'tai-po',
  3014: 'tai-wo',
  3007: 'sha-tin',
  3012: 'tai-wai',
  3009: 'ma-on-shan',
  3013: 'fo-tan',
  3020: 'tko',
  3006: 'sai-kung',
  4009: 'tung-chung',
  4004: 'cheung-chau',
  4001: 'lantau',
  4002: 'lamma-island',
  4003: 'discovery-bay',
};

function inferHkDistrictCode(
  districtId: number | null,
  districtName: string,
  fallbackCode: string
): string {
  if (districtId && OPENRICE_ID_TO_HK_DISTRICT[districtId]) {
    return OPENRICE_ID_TO_HK_DISTRICT[districtId];
  }
  if (districtName) {
    if (districtName.includes('將軍澳') || districtName.includes('坑口') || districtName.includes('寶琳')) return 'tko';
    if (districtName.includes('西貢')) return 'sai-kung';
    if (districtName.includes('馬鞍山')) return 'ma-on-shan';
    if (districtName.includes('沙田') || districtName.includes('大圍') || districtName.includes('火炭')) return 'sha-tin-tai-wai';
    if (districtName.includes('上環')) return 'sheung-wan';
    if (districtName.includes('西環') || districtName.includes('西營盤') || districtName.includes('堅尼地城')) return 'western';
    if (districtName.includes('中環') || districtName.includes('金鐘') || districtName.includes('半山') || districtName.includes('山頂')) return 'central';
    if (districtName.includes('銅鑼灣')) return 'causeway-bay';
    if (districtName.includes('天后') || districtName.includes('大坑')) return 'tin-hau-tai-hang';
    if (districtName.includes('灣仔') || districtName.includes('跑馬地')) return 'wan-chai';
    if (districtName.includes('北角') || districtName.includes('炮台山')) return 'north-point';
    if (districtName.includes('鰂魚涌') || districtName.includes('太古')) return 'quarry-bay-tai-koo';
    if (districtName.includes('西灣河') || districtName.includes('筲箕灣') || districtName.includes('柴灣') || districtName.includes('杏花邨')) return 'shau-kei-wan-chai-wan';
    if (districtName.includes('赤柱') || districtName.includes('淺水灣')) return 'stanley-repulse-bay';
    if (districtName.includes('香港仔') || districtName.includes('黃竹坑') || districtName.includes('鴨脷洲') || districtName.includes('數碼港')) return 'wong-chuk-hang-aberdeen';
    if (districtName.includes('尖沙咀')) return 'tsim-sha-tsui';
    if (districtName.includes('佐敦') || districtName.includes('油麻地')) return 'jordan-yau-ma-tei';
    if (districtName.includes('旺角') || districtName.includes('太子') || districtName.includes('大角咀')) return 'mong-kok';
    if (districtName.includes('長沙灣') || districtName.includes('荔枝角') || districtName.includes('美孚')) return 'cheung-sha-wan-lai-chi-kok';
    if (districtName.includes('深水埗') || districtName.includes('石硤尾')) return 'sham-shui-po';
    if (districtName.includes('紅磡') || districtName.includes('土瓜灣')) return 'hung-hom-to-kwa-wan';
    if (districtName.includes('九龍城') || districtName.includes('九龍塘') || districtName.includes('何文田')) return 'kowloon-city';
    if (districtName.includes('新蒲崗') || districtName.includes('黃大仙') || districtName.includes('鑽石山') || districtName.includes('樂富') || districtName.includes('彩虹')) return 'san-po-kong-diamond-hill';
    if (districtName.includes('九龍灣') || districtName.includes('牛頭角')) return 'kowloon-bay';
    if (districtName.includes('觀塘') || districtName.includes('藍田') || districtName.includes('油塘')) return 'kwun-tong';
    if (districtName.includes('大埔') || districtName.includes('太和')) return 'tai-po';
    if (districtName.includes('粉嶺') || districtName.includes('上水')) return 'fanling-sheung-shui';
    if (districtName.includes('荃灣') || districtName.includes('深井')) return 'tsuen-wan';
    if (districtName.includes('葵') || districtName.includes('青衣')) return 'kwai-tsing';
    if (districtName.includes('屯門')) return 'tuen-mun';
    if (districtName.includes('元朗') || districtName.includes('天水圍')) return 'yuen-long';
    if (districtName.includes('東涌') || districtName.includes('離島') || districtName.includes('大嶼山') || districtName.includes('長洲') || districtName.includes('南丫島')) return 'tung-chung-islands';
  }
  return PRIMARY_SUBREGION_CODES.includes(fallbackCode) ? fallbackCode : 'central';
}

export interface ScrapedOpenRiceVenue {
  poi_id: number;
  name: string;
  name_other_lang: string;
  address: string;
  address_other_lang: string;
  district: string;
  district_id: number | null;
  hk_district_code: string;
  latitude: number | null;
  longitude: number | null;
  price_band: string;
  price_band_en: string;
  price_min_hkd: number;
  price_max_hkd: number;
  price_bracket_id: string;
  score_overall: number | null;
  smiles: number;
  okays: number;
  cries: number;
  smiley_ratio: number;
  review_count: number;
  bookmark_count: number;
  cuisines: string[];
  dish_types: string[];
  phones: string[];
  opening_hours_text: string;
  url: string;
  photo_url: string | null;
  scraped_at: string;
}

interface CacheEntry {
  timestamp: number;
  venues: ScrapedOpenRiceVenue[];
  totalCount: number;
  source: string;
}

const OPENRICE_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

function extractCategories(raw: Record<string, unknown>, typeId: number): string[] {
  const cats = Array.isArray(raw.categories) ? raw.categories : [];
  const names: string[] = [];
  for (const c of cats) {
    if (
      c &&
      typeof c === 'object' &&
      (c as Record<string, unknown>).categoryTypeId === typeId &&
      typeof (c as Record<string, unknown>).name === 'string'
    ) {
      names.push(String((c as Record<string, unknown>).name).trim());
    }
  }
  return names;
}

function formatOpeningHours(raw: Record<string, unknown>): string {
  const poiHours = Array.isArray(raw.poiHours) ? raw.poiHours : [];
  if (poiHours.length === 0) return '11:30 - 22:00';

  for (const h of poiHours) {
    if (!h || typeof h !== 'object') continue;
    const item = h as Record<string, unknown>;
    if (item.day || item.lunarDay || item.weekOfMonth) continue;
    if (item.isClose) continue;
    if (item.is24hr) return '00:00 - 24:00 (24小時營業)';

    const spans: string[] = [];
    for (let n = 1; n <= 3; n++) {
      const start = item[`period${n}Start`];
      const end = item[`period${n}End`];
      if (typeof start === 'string' && typeof end === 'string' && start && end) {
        spans.push(`${start.slice(0, 5)}-${end.slice(0, 5)}`);
      }
    }
    if (spans.length > 0) {
      return spans.join(' / ');
    }
  }
  return '11:30 - 21:30';
}

function parseOpenRiceRawRow(
  raw: Record<string, unknown>,
  nowIso: string,
  fallbackDistrictCode: string
): ScrapedOpenRiceVenue | null {
  const poiId = Number(raw.poiId || 0);
  if (!poiId) return null;

  // Exclude moved or renovating venues (status 10 = open)
  const status = Number(raw.status ?? 10);
  if (status !== STATUS_OPEN) return null;

  const name = String(raw.name || '').trim();
  const nameOther = String(raw.nameOtherLang || '').trim();
  if (!name && !nameOther) return null;

  const address = String(raw.address || '').trim();
  const addressOther = String(raw.addressOtherLang || '').trim();

  const districtObj =
    raw.district && typeof raw.district === 'object'
      ? (raw.district as Record<string, unknown>)
      : {};
  const districtName = String(districtObj.name || '').trim();
  const districtId = districtObj.districtId ? Number(districtObj.districtId) : null;
  const hkDistrictCode = inferHkDistrictCode(districtId, districtName, fallbackDistrictCode);

  const lat = raw.mapLatitude !== undefined ? Number(raw.mapLatitude) : null;
  const lng = raw.mapLongitude !== undefined ? Number(raw.mapLongitude) : null;

  const priceRangeId = Number(raw.priceRangeId || 2);
  const bandInfo = PRICE_BANDS[priceRangeId] || PRICE_BANDS[2];

  const rawScore = Number(raw.scoreOverall || 0);
  const scoreOverall = rawScore > 0 ? Math.round(rawScore * 100) / 100 : null;

  const smiles = Math.max(0, Number(raw.scoreSmile || 0));
  const cries = Math.max(0, Number(raw.scoreCry || 0));
  const reviewCount = Math.max(smiles + cries, Number(raw.reviewCount || 0));
  const okays = Math.max(0, reviewCount - smiles - cries);

  const totalSmileCry = smiles + cries;
  const smileyRatio =
    totalSmileCry > 0
      ? Math.round((smiles / totalSmileCry) * 100)
      : scoreOverall && scoreOverall >= 4.0
        ? 88
        : 80;

  const bookmarkCount = Math.max(0, Number(raw.bookmarkedUserCount || 0));

  const cuisines = extractCategories(raw, 1);
  const dishTypes = extractCategories(raw, 3);
  const phones = Array.isArray(raw.phones)
    ? raw.phones.map((p) => String(p || '').trim()).filter(Boolean)
    : [];

  const doorPhoto =
    raw.doorPhoto && typeof raw.doorPhoto === 'object'
      ? (raw.doorPhoto as Record<string, unknown>)
      : {};
  const photoUrls =
    doorPhoto.urls && typeof doorPhoto.urls === 'object'
      ? (doorPhoto.urls as Record<string, unknown>)
      : {};
  const photoUrl =
    String(photoUrls.standard || photoUrls.full || doorPhoto.url || '').trim() || null;

  const shortenUrl = String(raw.shortenUrl || '').trim();
  const url =
    shortenUrl ||
    `https://www.openrice.com/zh/hongkong/restaurants?what=${encodeURIComponent(name || nameOther)}`;

  return {
    poi_id: poiId,
    name: name || nameOther,
    name_other_lang: nameOther || name,
    address: address || addressOther,
    address_other_lang: addressOther || address,
    district: districtName,
    district_id: districtId,
    hk_district_code: hkDistrictCode,
    latitude: lat && !Number.isNaN(lat) ? lat : null,
    longitude: lng && !Number.isNaN(lng) ? lng : null,
    price_band: bandInfo.bandYue,
    price_band_en: bandInfo.bandEn,
    price_min_hkd: bandInfo.min,
    price_max_hkd: bandInfo.max,
    price_bracket_id: bandInfo.bracketId,
    score_overall: scoreOverall,
    smiles,
    okays,
    cries,
    smiley_ratio: smileyRatio,
    review_count: reviewCount,
    bookmark_count: bookmarkCount,
    cuisines,
    dish_types: dishTypes,
    phones,
    opening_hours_text: formatOpeningHours(raw),
    url,
    photo_url: photoUrl,
    scraped_at: nowIso,
  };
}

async function fetchOpenRiceDirectSingleBatch(
  districtIds: number[],
  keyword: string,
  fallbackDistrictCode: string,
  maxRows = 150
): Promise<{ venues: ScrapedOpenRiceVenue[]; totalCount: number; source: string }> {
  const params = new URLSearchParams();
  params.set('uiLang', 'zh');
  params.set('uiCity', 'hongkong');
  params.set('status', String(STATUS_OPEN));
  params.set('rows', String(maxRows));
  params.set('startAt', '0');

  for (const did of districtIds) {
    params.append('districtId', String(did));
  }
  if (keyword.trim()) {
    params.set('whatwhere', keyword.trim());
  }

  const url = `${OPENRICE_API}?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 11000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': OPENRICE_UA,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-HK,zh;q=0.9,en-HK;q=0.8,en;q=0.7',
        Referer: 'https://www.openrice.com/zh/hongkong',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`OpenRice HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      paginationResult?: {
        count?: number;
        results?: Array<Record<string, unknown>>;
      };
    };

    const rawResults = data.paginationResult?.results || [];
    const totalCount = Number(data.paginationResult?.count || rawResults.length);
    const nowIso = new Date().toISOString();

    const seenIds = new Set<number>();
    const parsedVenues: ScrapedOpenRiceVenue[] = [];

    for (const raw of rawResults) {
      const parsed = parseOpenRiceRawRow(raw, nowIso, fallbackDistrictCode);
      if (!parsed || seenIds.has(parsed.poi_id)) continue;
      seenIds.add(parsed.poi_id);
      parsedVenues.push(parsed);
    }

    return {
      venues: parsedVenues,
      totalCount,
      source: 'MetaDotHK/openrice-scraper (OpenRice v2 Live API)',
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchOpenRiceMultiDistricts(
  districtCodes: string[],
  keyword: string
): Promise<{ venues: ScrapedOpenRiceVenue[]; totalCount: number; source: string }> {
  // If 1 to 3 districts are selected, fetch each district concurrently so every selected district is well represented
  if (districtCodes.length >= 1 && districtCodes.length <= 4) {
    const rowsPerDistrict = districtCodes.length === 1 ? 140 : 75;
    const batchResults = await Promise.all(
      districtCodes.map((code) => {
        const ids = HK_DISTRICT_TO_OPENRICE_IDS[code] || HK_DISTRICT_TO_OPENRICE_IDS['central-western'];
        return fetchOpenRiceDirectSingleBatch(ids, keyword, code, rowsPerDistrict);
      })
    );

    const seen = new Set<number>();
    const merged: ScrapedOpenRiceVenue[] = [];
    let totalCount = 0;

    for (const res of batchResults) {
      totalCount += res.totalCount;
      for (const v of res.venues) {
        if (!seen.has(v.poi_id)) {
          seen.add(v.poi_id);
          merged.push(v);
        }
      }
    }

    return {
      venues: merged,
      totalCount,
      source: 'MetaDotHK/openrice-scraper (OpenRice v2 Live API)',
    };
  }

  // If 5+ districts are selected (e.g. a whole region or multiple regions), group into up to 3 region-level batches
  const allIds: number[] = [];
  for (const code of districtCodes) {
    const ids = HK_DISTRICT_TO_OPENRICE_IDS[code] || [];
    allIds.push(...ids);
  }
  const chunkSize = Math.ceil(districtCodes.length / 3);
  const chunks: string[][] = [];
  for (let i = 0; i < districtCodes.length; i += chunkSize) {
    chunks.push(districtCodes.slice(i, i + chunkSize));
  }

  const batchResults = await Promise.all(
    chunks.map((chunk) => {
      const ids = chunk.flatMap((c) => HK_DISTRICT_TO_OPENRICE_IDS[c] || []);
      return fetchOpenRiceDirectSingleBatch(ids, keyword, chunk[0] || 'central-western', 90);
    })
  );

  const seen = new Set<number>();
  const merged: ScrapedOpenRiceVenue[] = [];
  let totalCount = 0;

  for (const res of batchResults) {
    totalCount += res.totalCount;
    for (const v of res.venues) {
      if (!seen.has(v.poi_id)) {
        seen.add(v.poi_id);
        merged.push(v);
      }
    }
  }

  return {
    venues: merged,
    totalCount: totalCount || merged.length,
    source: 'MetaDotHK/openrice-scraper (OpenRice v2 Live API)',
  };
}

async function fetchOpenRiceViaPythonCli(
  districtIds: number[],
  keyword: string,
  fallbackDistrictCode: string,
  maxRows = 80
): Promise<{ venues: ScrapedOpenRiceVenue[]; totalCount: number; source: string }> {
  const scriptPath = path.join(__dirname, 'scripts', 'openrice_scraper', 'scrape.py');
  const args = ['--format', 'json', '--max', String(maxRows), '--delay', '0.15'];
  if (districtIds.length > 0) {
    args.push('--district', districtIds.slice(0, 8).join(','));
  }
  if (keyword.trim()) {
    args.push('--keywords', keyword.trim());
  }

  const { stdout } = await execFileAsync('python3', [scriptPath, ...args], {
    timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
  });

  const rows = JSON.parse(stdout) as Array<Record<string, unknown>>;
  const nowIso = new Date().toISOString();

  const venues: ScrapedOpenRiceVenue[] = rows.map((r) => {
    const priceId = Number(r.price_range_id || 2);
    const bandInfo = PRICE_BANDS[priceId] || PRICE_BANDS[2];
    const smiles = Number(r.smiles || 0);
    const cries = Number(r.cries || 0);
    const reviewCount = Math.max(smiles + cries, Number(r.review_count || 0));
    const okays = Math.max(0, reviewCount - smiles - cries);
    const totalSmileCry = smiles + cries;
    const score = r.score_overall ? Number(r.score_overall) : null;
    const smileyRatio =
      totalSmileCry > 0
        ? Math.round((smiles / totalSmileCry) * 100)
        : score && score >= 4.0
          ? 88
          : 80;

    let hoursText = '11:30 - 21:30';
    if (r.opening_hours && typeof r.opening_hours === 'object') {
      const oh = r.opening_hours as Record<string, string[]>;
      const firstOpen = Object.values(oh).find((arr) => Array.isArray(arr) && arr.length > 0);
      if (firstOpen) hoursText = firstOpen.join(' / ');
    }

    const districtName = String(r.district || '');
    const districtId = r.district_id ? Number(r.district_id) : null;
    const hkDistrictCode = inferHkDistrictCode(districtId, districtName, fallbackDistrictCode);

    return {
      poi_id: Number(r.poi_id || 0),
      name: String(r.name || ''),
      name_other_lang: String(r.name_other_lang || r.name || ''),
      address: String(r.address || ''),
      address_other_lang: String(r.address_other_lang || r.address || ''),
      district: districtName,
      district_id: districtId,
      hk_district_code: hkDistrictCode,
      latitude: r.latitude ? Number(r.latitude) : null,
      longitude: r.longitude ? Number(r.longitude) : null,
      price_band: bandInfo.bandYue,
      price_band_en: bandInfo.bandEn,
      price_min_hkd: bandInfo.min,
      price_max_hkd: bandInfo.max,
      price_bracket_id: bandInfo.bracketId,
      score_overall: score,
      smiles,
      okays,
      cries,
      smiley_ratio: smileyRatio,
      review_count: reviewCount,
      bookmark_count: Number(r.bookmark_count || 0),
      cuisines: Array.isArray(r.cuisines) ? r.cuisines.map(String) : [],
      dish_types: Array.isArray(r.dish_types) ? r.dish_types.map(String) : [],
      phones: Array.isArray(r.phones) ? r.phones.map(String) : [],
      opening_hours_text: hoursText,
      url: String(r.url || ''),
      photo_url: r.photo_url ? String(r.photo_url) : null,
      scraped_at: String(r.scraped_at || nowIso),
    };
  });

  return {
    venues,
    totalCount: venues.length,
    source: 'MetaDotHK/openrice-scraper (Python CLI)',
  };
}

function screenGoodOpenRiceVenues(venues: ScrapedOpenRiceVenue[]): ScrapedOpenRiceVenue[] {
  // Screen for High Smiley Ratio & 4.0+★ rating while keeping all qualifying restaurants
  const highRated = venues.filter((v) => {
    const scorePass = v.score_overall !== null ? v.score_overall >= 3.9 : v.smiley_ratio >= 70;
    const smileyPass = v.smiley_ratio >= 68 || v.smiles >= 10 || v.bookmark_count >= 50;
    return scorePass && smileyPass;
  });

  const pool = highRated.length >= 6 ? highRated : venues;

  return [...pool].sort((a, b) => {
    const scoreA = a.score_overall ?? 4.0;
    const scoreB = b.score_overall ?? 4.0;
    if (Math.abs(scoreB - scoreA) >= 0.08) return scoreB - scoreA;
    if (Math.abs(b.smiley_ratio - a.smiley_ratio) >= 4) return b.smiley_ratio - a.smiley_ratio;
    return b.smiles - a.smiles;
  });
}

async function handleOpenRiceScrapeRequest(req: express.Request, res: express.Response) {
  try {
    const rawDistrictCodes = String(
      req.query.districtCodes || req.query.districtCode || 'central-western'
    ).trim();
    const parsedCodes = Array.from(
      new Set(
        rawDistrictCodes
          .split(',')
          .map((s) => s.trim())
          .filter((s) => Boolean(s) && Boolean(HK_DISTRICT_TO_OPENRICE_IDS[s]))
      )
    );
    const districtCodes = parsedCodes.length > 0 ? parsedCodes : ['central-western'];

    const rawQuery = String(req.query.q || '').trim();
    const forceRefresh = req.query.refresh === '1';

    const cacheKey = `${districtCodes.sort().join(',')}_${rawQuery.toLowerCase()}`;
    const cached = OPENRICE_CACHE.get(cacheKey);
    if (
      !forceRefresh &&
      cached &&
      Date.now() - cached.timestamp < CACHE_TTL_MS &&
      cached.venues.length > 0
    ) {
      res.json({
        ok: true,
        cached: true,
        source: cached.source,
        totalCount: cached.totalCount,
        venues: cached.venues,
      });
      return;
    }

    let result: { venues: ScrapedOpenRiceVenue[]; totalCount: number; source: string };
    try {
      result = await fetchOpenRiceMultiDistricts(districtCodes, rawQuery);
      // If a keyword search within selected districts returned 0 results, broaden to city-wide OpenRice search for that keyword
      if (result.venues.length === 0 && rawQuery) {
        result = await fetchOpenRiceDirectSingleBatch([], rawQuery, districtCodes[0], 120);
        // If still 0 results, fallback to fetching all venues in the selected districts so client-side filtering can find matches
        if (result.venues.length === 0) {
          result = await fetchOpenRiceMultiDistricts(districtCodes, '');
        }
      }
    } catch {
      const fallbackIds = districtCodes.flatMap((c) => HK_DISTRICT_TO_OPENRICE_IDS[c] || []);
      result = await fetchOpenRiceViaPythonCli(fallbackIds, rawQuery, districtCodes[0], 80);
    }

    const screened = screenGoodOpenRiceVenues(result.venues);

    if (screened.length > 0) {
      OPENRICE_CACHE.set(cacheKey, {
        timestamp: Date.now(),
        venues: screened,
        totalCount: result.totalCount,
        source: result.source,
      });
    }

    res.json({
      ok: true,
      cached: false,
      source: result.source,
      totalCount: result.totalCount,
      venues: screened,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'OpenRice scrape failed',
      venues: [],
    });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Primary OpenRice Scraper API endpoint (MetaDotHK/openrice-scraper)
  app.get('/api/scrape-openrice', handleOpenRiceScrapeRequest);
  // Alias for backward compatibility
  app.get('/api/scrape-restaurants', handleOpenRiceScrapeRequest);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
