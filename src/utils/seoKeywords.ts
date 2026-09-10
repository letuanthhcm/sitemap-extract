/**
 * Utility to extract SEO keywords and 2-tier categorization from sitemap URLs
 * Separates URLs into:
 * Column 1: Keyword (clean search query extracted from slug)
 * Column 2: Phân nhóm 2 Cấp: Cấp 1/Cấp 2 (e.g. Food/Cat, Bakeware/Sets, Storage/Cabinets)
 */

export interface KeywordAndGroup {
  keyword: string;
  rawKeyword: string;
  group: string; // "Cấp 1/Cấp 2" ví dụ: Food/Cat, Bakeware/Sets
  tier1: string; // Cấp 1 (ví dụ: Food, Bakeware, Storage)
  tier2: string; // Cấp 2 (ví dụ: Cat, Sets, Cabinets)
}

export interface KeywordOptions {
  prune?: boolean; // Bật tỉa tót cắt gọn keyword (mặc định: true)
}

// --- Pre-compiled Regular Expressions & Static Sets for Maximum Performance on Large Datasets ---
const SPEC_UNITS_REGEX =
  /^(inch(es)?|cm|mm|m|ft|feet|yd|yards|kg|g|lbs|oz|volts?|v|watts?|w|amps?|mah|hz|khz|mhz|ghz|gb|tb|mb|kb|core|piece|pack|pcs|set|door|port|channel|speed|phase|cycle|pin|ply|tier|row|slot|blade|person|passenger|quart|gallon|liters?)\b/i;

const LEADING_WORD_NUM_REGEX =
  /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|hundred)\s+(.+)$/i;

const GENERIC_PATH_WORDS = new Set([
  'category',
  'categories',
  'danh-muc',
  'chuyen-muc',
  'san-pham',
  'product',
  'products',
  'item',
  'items',
  'tag',
  'tags',
  'archives',
  'post',
  'posts',
  'p',
  'page',
  'article',
  'articles',
  'news',
  'tin-tuc',
  'blog',
]);

const FOOD_PATTERN = /\b(food|treats|kibble|diet|nutrition|thuc\s*an)\b/i;
const PET_PATTERN = /\b(cat|dog|puppy|kitten|pet|fish|bird|meo|cho|cun|thu\s*cung)\b/i;

const PET_MAP: Record<string, string> = {
  meo: 'Cat',
  cat: 'Cat',
  cho: 'Dog',
  dog: 'Dog',
  kitten: 'Kitten',
  puppy: 'Puppy',
  pet: 'Pet',
  'thu cung': 'Pet',
  fish: 'Fish',
  bird: 'Bird',
};

// High-Precision Taxonomy Catalog: [Category (Cấp 1), Subcategory (Cấp 2), RegExp]
const TAXONOMY_CATALOG: Array<[string, string, RegExp]> = [
  // --- Kitchen ---
  ['Kitchen', 'Faucet', /\bfaucets?\b/i],
  ['Kitchen', 'Cabinets', /\b(kitchen\s*cabinets?)\b/i],
  ['Kitchen', 'Sink', /\b(bar\s*sinks?|kitchen\s*sinks?|sinks?)\b/i],
  ['Kitchen', 'Bakeware', /\bbakeware(\s*sets?)?\b/i],
  ['Kitchen', 'Cookware', /\b(roasting\s*pans?|cookware|pans?|pots?)\b/i],
  ['Kitchen', 'Toaster Oven', /\b(toaster\s*ovens?|toaster|ovens?)\b/i],
  ['Kitchen', 'Pizza Stone', /\bpizza\s*stones?\b/i],
  ['Kitchen', 'Blender', /\b(blenders?|food\s*processors?|juicers?)\b/i],
  ['Kitchen', 'Dishwasher', /\bdishwashers?\b/i],
  ['Kitchen', 'Refrigerator', /\b(refrigerators?|fridges?|freezers?)\b/i],
  ['Kitchen', 'Cutting Board', /\bcutting\s*boards?\b/i],
  ['Kitchen', 'Kitchen Island', /\b(kitchen\s*islands?)\b/i],

  // --- Bathroom ---
  ['Bathroom', 'Shower Door', /\bshower\s*doors?\b/i],
  ['Bathroom', 'Shower Head', /\bshower\s*heads?\b/i],
  ['Bathroom', 'Shower Chair', /\bshower\s*chairs?\b/i],
  ['Bathroom', 'Toilet', /\b(toilets?(\s*suites?)?|bidets?|bon\s*cau)\b/i],
  ['Bathroom', 'Vanity', /\b(bathroom\s*vanit(y|ies)|vanit(y|ies))\b/i],
  ['Bathroom', 'Storage Cart', /\b(bathroom\s*(storage\s*)?carts?)\b/i],
  ['Bathroom', 'Shower', /\b(showers?|bathtubs?|tubs?)\b/i],
  ['Bathroom', 'Towel Warmer', /\btowel\s*warmers?\b/i],

  // --- Appliances ---
  ['Appliances', 'Dehumidifier', /\bdehumidifiers?\b/i],
  ['Appliances', 'Humidifier', /\bhumidifiers?\b/i],
  ['Appliances', 'Air Purifier', /\bair\s*purifiers?\b/i],
  ['Appliances', 'Air Conditioner', /\b(air\s*conditioners?|ac\s*units?)\b/i],
  ['Appliances', 'Water Filtration', /\b(water\s*filtrations?|purification\s*systems?|water\s*filters?)\b/i],
  ['Appliances', 'Vacuum', /\b(vacuums?|robot\s*vacuums?)\b/i],
  ['Appliances', 'Pressure Washer', /\bpressure\s*washers?\b/i],
  ['Appliances', 'Heater', /\b(space\s*heaters?|heaters?)\b/i],

  // --- Bedroom ---
  ['Bedroom', 'Mattress Topper', /\b(mattress\s*toppers?|toppers?)\b/i],
  ['Bedroom', 'Mattress', /\bmattress(es)?\b/i],
  ['Bedroom', 'Bedding', /\b(bed\s*sheets?|sheets?|pillows?|blankets?|comforters?|duvets?)\b/i],
  ['Bedroom', 'Bed Frame', /\b(bed\s*frames?|beds?)\b/i],
  ['Bedroom', 'Nightstand', /\bnightstands?\b/i],

  // --- Living Room & Heating ---
  ['Living Room', 'Fireplace', /\b(linear\s*fireplaces?|fireplaces?|fire\s*pits?|lo\s*suoi)\b/i],
  ['Living Room', 'Sofa', /\b(sofas?|couches|recliners?)\b/i],
  ['Living Room', 'Coffee Table', /\bcoffee\s*tables?\b/i],
  ['Living Room', 'TV Stand', /\btv\s*stands?\b/i],

  // --- Office ---
  ['Office', 'Bench', /\b(office\s*bench(\s*seating)?|bench\s*seating)\b/i],
  ['Office', 'File Cabinet', /\b(file\s*cabinets?|cabinet\s*casters?)\b/i],
  ['Office', 'Desk', /\b(office\s*desks?|desks?|workstations?)\b/i],
  ['Office', 'Office Chair', /\b(office\s*chairs?|desk\s*chairs?)\b/i],
  ['Office', 'Paper Shredder', /\bpaper\s*shredders?\b/i],

  // --- Art & Craft ---
  ['Art', 'Easel', /\beasels?\b/i],
  ['Art', 'Canvas Prints', /\b(canvas(\s*prints?)?|wall\s*art|paintings?)\b/i],
  ['Art', 'Picture Frames', /\bpicture\s*frames?\b/i],

  // --- Flooring & Tile ---
  ['Flooring', 'Skirting Board', /\b(skirting\s*boards?|baseboards?)\b/i],
  ['Flooring', 'Wood Flooring', /\b(wood\s*floorings?|bamboo\s*(tiger\s*)?wood|hardwood|laminates?)\b/i],
  ['Flooring', 'Tile', /\b(mosaic\s*tiles?|tiles?)\b/i],
  ['Flooring', 'Carpet', /\b(carpets?|rugs?)\b/i],

  // --- Doors & Windows ---
  ['Doors', 'Gate', /\b(door\s*gates?|gates?|folding\s*doors?|retractable\s*door)\b/i],
  ['Doors', 'Front Door', /\b(front\s*doors?|storm\s*doors?|entry\s*doors?)\b/i],
  ['Windows', 'Blinds', /\b(integral\s*blinds?|blinds?|shades?|curtains?)\b/i],
  ['Doors', 'Sliding Door', /\bsliding\s*doors?\b/i],

  // --- Pet ---
  ['Pet', 'Dog Door', /\b(doggie\s*doors?|dog\s*doors?|pet\s*doors?)\b/i],
  ['Pet', 'Litter Box', /\blitter\s*box(es)?\b/i],
  ['Pet', 'Pet Bed', /\b(dog\s*beds?|cat\s*beds?)\b/i],
  ['Pet', 'Crate', /\b(dog\s*crates?|kennels?)\b/i],

  // --- Outdoor & Garden ---
  ['Outdoor', 'Pool Covers', /\bpool\s*covers?\b/i],
  ['Outdoor', 'Hose Reels', /\b(hose\s*reels?|garden\s*hoses?)\b/i],
  ['Outdoor', 'Compost Bins', /\bcompost\s*bins?\b/i],
  ['Outdoor', 'Grill', /\b(grills?|bbq|smokers?)\b/i],
  ['Outdoor', 'Lawn Mower', /\b(lawn\s*mowers?|mowers?)\b/i],

  // --- Lighting ---
  ['Lighting', 'Sconces', /\b(wall\s*sconces?|sconces?)\b/i],
  ['Lighting', 'Chandelier', /\bchandeliers?\b/i],
  ['Lighting', 'Lamps', /\blamps?\b/i],
  ['Lighting', 'Pendant Light', /\bpendant\s*lights?\b/i],

  // --- Storage ---
  ['Storage', 'Cabinets', /\b(storage\s*cabinets?|cabinets?)\b/i],
  ['Storage', 'Cart', /\b(storage\s*carts?|rolling\s*carts?)\b/i],
  ['Storage', 'Bins', /\b(storage\s*bins?|totes?|storage\s*boxes?)\b/i],

  // --- Electronics ---
  ['Electronics', 'Headphones', /\b(headphones?|earbuds?|headsets?)\b/i],
  ['Electronics', 'Drones', /\bdrones?\b/i],
  ['Electronics', 'Cameras', /\bcameras?\b/i],
  ['Electronics', 'Speakers', /\bspeakers?\b/i],

  // --- Baby & Kids ---
  ['Baby', 'Stroller', /\b(strollers?|prams?)\b/i],
  ['Baby', 'Car Seat', /\bcar\s*seats?\b/i],
  ['Baby', 'Crib', /\bcribs?\b/i],

  // --- Automotive ---
  ['Automotive', 'Tires', /\btires?\b/i],
  ['Automotive', 'Dash Cam', /\bdash\s*cams?\b/i],
  ['Automotive', 'Floor Mats', /\bfloor\s*mats?\b/i],

  // --- Sports & Fitness ---
  ['Fitness', 'Treadmill', /\btreadmills?\b/i],
  ['Fitness', 'Dumbbells', /\bdumbbells?\b/i],
  ['Fitness', 'Yoga Mat', /\byoga\s*mats?\b/i],
  ['Fitness', 'Exercise Bike', /\bexercise\s*bikes?\b/i],
];

const ROOM_MAP: Record<string, string> = {
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  bedroom: 'Bedroom',
  office: 'Office',
  living: 'Living Room',
  dining: 'Dining Room',
  outdoor: 'Outdoor',
  garden: 'Outdoor',
  patio: 'Outdoor',
  garage: 'Garage',
};

const MODIFIER_WORDS = new Set([
  'aluminized',
  'steel',
  'stainless',
  'nonstick',
  'non-stick',
  'ceramic',
  'glass',
  'cast',
  'iron',
  'smart',
  'electric',
  'manual',
  'digital',
  'cheap',
  'portable',
  'heavy',
  'duty',
  'outdoor',
  'indoor',
  'large',
  'small',
  'mini',
  'compact',
  'commercial',
  'wireless',
  'waterproof',
  'automatic',
  'retractable',
  'foldable',
  'folding',
  'wooden',
  'metal',
  'plastic',
  'cotton',
  'leather',
  'rubber',
  'premium',
  'budget',
  'affordable',
  'professional',
  'pro',
  'ultra',
  'plus',
  'max',
  'dry',
  'wet',
  'canned',
  'raw',
  'solid',
  'oak',
  'matte',
  'black',
  'white',
  'tiger',
  'new',
  'quiet',
  'close',
  'coupled',
  'linear',
  'dep',
  'cao',
  'cap',
  'gia',
  're',
  'chinh',
  'hang',
  'thong',
  'minh',
]);

/**
 * Tỉa tót cắt gọn Keyword từ URL slug:
 * - Lược bỏ chữ "the" đứng trước (ví dụ "the best" -> "best", "the 10 best" -> "10 best", "the ultimate" -> "ultimate")
 * - Lược bỏ các tiền tố / cụm đếm thứ hạng như "top 3", "top 5", "top 10", "top 20", "top 50", "top 100", "top \d+"...
 * - Lược bỏ các từ số đếm tiếng Anh ("top three", "top five", "top ten")
 * - Lược bỏ dạng "\d+ best" ở đầu (ví dụ: "10 best laptops" -> "best laptops")
 * - Lược bỏ mạo từ đứng đầu (the, a, an)
 * - Tự động thu gọn khoảng trắng thừa và làm sạch ký tự phân cách
 * - Fallback an toàn: nếu sau khi tỉa chuỗi bị rỗng thì hoàn trả từ khóa gốc ban đầu
 */
export function pruneKeyword(rawKeyword: string): string {
  if (!rawKeyword || typeof rawKeyword !== 'string') return '';

  let text = rawKeyword.trim();
  if (!text) return '';

  // 1. Bỏ mạo từ "the" đứng trước các tính từ so sánh/cực cấp hoặc ở đầu cụm từ
  // Ví dụ: "the best" -> "best", "the top" -> "top", "the most" -> "most", "the latest" -> "latest"
  text = text.replace(
    /\bthe\s+(best|top|most|greatest|cheapest|latest|ultimate|highest|easiest|fastest|perfect|smartest|simplest|coolest|finest|premier|leading)\b/gi,
    '$1'
  );

  // Bỏ mạo từ đứng đầu: "the ", "a ", "an "
  // Ví dụ: "the best headphones" -> "best headphones", "the complete guide" -> "complete guide"
  text = text.replace(/^(the|a|an)\s+/i, '');

  // 2. Bỏ các cụm "top 3", "top 5", "top 10", "top 15", "top 20", "top 50", "top 100", "top \d+"...
  // Hỗ trợ cả "top 10", "top-10", "top10", và có thể kèm theo "of", "in", "for", "nhung", "cac"
  text = text.replace(/\btop\s*\d+\s*(of|in|for|nhung|cac)?\b/gi, '');

  // Bỏ dạng số chữ sau top: "top three", "top five", "top ten"...
  text = text.replace(
    /\btop\s+(one|two|three|four|five|six|seven|eight|nine|ten|twenty|hundred)\s*(of|in|for)?\b/gi,
    ''
  );

  // 3. Bỏ số đếm bài viết listicle ở đầu câu (ví dụ: "6 anti slip rubber mats...", "10 tips...", "7 ways to...", "10 best...")
  // 3a. Trường hợp số đếm chữ số đứng đầu: "6 anti slip...", "10 best...", "7 quietest..."
  const leadingNumMatch = text.match(/^(\d+)\s+(.+)$/);
  if (leadingNumMatch) {
    const [, , remainder] = leadingNumMatch;
    const words = remainder.split(/\s+/);
    // Nếu từ kế tiếp không phải là đơn vị thông số và sau đó còn ít nhất 2 từ
    if (!SPEC_UNITS_REGEX.test(words[0]) && words.length >= 2) {
      text = remainder;
    }
  }

  // 3b. Trường hợp số đếm dạng chữ đứng đầu: "six anti slip...", "ten best...", "five easy..."
  const leadingWordNumMatch = text.match(LEADING_WORD_NUM_REGEX);
  if (leadingWordNumMatch) {
    const [, , remainder] = leadingWordNumMatch;
    const words = remainder.split(/\s+/);
    if (!SPEC_UNITS_REGEX.test(words[0]) && words.length >= 2) {
      text = remainder;
    }
  }

  // Dạng "\d+ best" trực tiếp
  text = text.replace(/^\d+\s+best\b/i, 'best');

  // 4. Thu gọn dấu nối, dấu gạch chéo, dấu hai chấm thừa
  text = text
    .replace(/[–—:|,.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Bỏ các từ nối mồ côi ở đầu hoặc cuối sau khi cắt (ví dụ: "of", "for", "in", "to")
  text = text.replace(/^(of|for|in|to|and|&|va|cua|cho|tai)\s+/i, '');
  text = text.replace(/\s+(of|for|in|to|and|&|va|cua|cho|tai)$/i, '');

  text = text.replace(/\s+/g, ' ').trim();

  // An toàn tuyệt đối: nếu sau khi tỉa mà chuỗi rỗng, giữ lại chuỗi gốc
  return text || rawKeyword.trim();
}

/**
 * Capitalize first letter of each word
 */
function capitalizeWords(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function capSingle(str: string): string {
  if (!str) return '';
  const s = str.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Extract clean keyword and intelligent 2-tier categorization (Cấp 1/Cấp 2) from any URL
 */
export function extractKeywordAndGroup(
  rawUrl: string,
  options?: KeywordOptions
): KeywordAndGroup {
  try {
    let urlStr = (rawUrl || '').trim();
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = 'https://' + urlStr;
    }

    const parsed = new URL(urlStr);
    let pathname = decodeURIComponent(parsed.pathname).trim().replace(/\/+$/, '');
    if (!pathname) {
      return {
        keyword: parsed.hostname,
        rawKeyword: parsed.hostname,
        group: 'Home/General',
        tier1: 'Home',
        tier2: 'General',
      };
    }

    const rawSegments = pathname.split('/').filter(Boolean);
    const lastSegment = rawSegments[rawSegments.length - 1] || '';

    // Strip extensions (.html, .htm, .php, .aspx, .xml, .json, .pdf, etc.)
    const cleanSlug = lastSegment.replace(/\.(html?|php|aspx?|xml|json|pdf)$/i, '');

    // Clean keyword: replace hyphens, underscores, plus with spaces, collapse spaces
    const rawKeyword = cleanSlug.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
    const shouldPrune = options?.prune !== false;
    const keyword = shouldPrune ? pruneKeyword(rawKeyword) : rawKeyword;

    // 1. Check URL directory structure (if hierarchical path has meaningful categories)
    if (rawSegments.length > 2) {
      const parentSegments = rawSegments.slice(0, -1);
      const meaningfulParents = parentSegments.filter(
        (s) => !GENERIC_PATH_WORDS.has(s.toLowerCase().replace(/[-_+]/g, ''))
      );

      if (meaningfulParents.length >= 2) {
        const t1 = capitalizeWords(meaningfulParents[meaningfulParents.length - 2].replace(/[-_+]/g, ' '));
        const t2 = capitalizeWords(meaningfulParents[meaningfulParents.length - 1].replace(/[-_+]/g, ' '));
        return {
          keyword,
          rawKeyword,
          group: `${t1}/${t2}`,
          tier1: t1,
          tier2: t2,
        };
      } else if (meaningfulParents.length === 1) {
        const t1 = capitalizeWords(meaningfulParents[0].replace(/[-_+]/g, ' '));
        // Sub-tier from slug
        const subTier = deriveSubTierFromKeyword(keyword);
        return {
          keyword,
          rawKeyword,
          group: `${t1}/${subTier}`,
          tier1: t1,
          tier2: subTier,
        };
      }
    }

    // 2. Semantic 2-Tier NLP extraction from the keyword phrase
    const { tier1, tier2 } = deriveTwoTierFromText(keyword, rawUrl);
    return {
      keyword,
      rawKeyword,
      group: `${tier1}/${tier2}`,
      tier1,
      tier2,
    };
  } catch {
    return {
      keyword: rawUrl,
      rawKeyword: rawUrl,
      group: 'General/Other',
      tier1: 'General',
      tier2: 'Other',
    };
  }
}

/**
 * Derive sub-tier (Cấp 2) when Cấp 1 is already known from parent directory
 */
function deriveSubTierFromKeyword(keyword: string): string {
  const { tier2 } = deriveTwoTierFromText(keyword);
  return tier2 || 'General';
}

/**
 * Core 2-tier classifier: Derives true Category (Cấp 1) and Subcategory (Cấp 2)
 *
 * Distinguishes:
 * - Category (Cấp 1): Broad departmental/room/niche category
 *   (e.g. Kitchen, Bathroom, Bedroom, Appliances, Flooring, Doors, Windows, Art, Pet, Food, Office, Outdoor, Lighting, Storage...)
 * - Subcategory (Cấp 2): Specific product type / entity
 *   (e.g. Faucet, Dehumidifier, Shower Door, Toilet, Easel, Skirting Board, Dog Door, Cat, Dog, Cabinets, Mattress Topper, Tile...)
 *
 * Handles and strips:
 * - Trailing feature specifications ("hot and cold", "with pump", "with built in...", "in ground", "with storage")
 * - Dimensions and measurements ("51 inch", "60", "10 x 15", "queen", "king")
 * - Material and modifier adjectives ("quiet", "heavy duty", "solid oak", "matte black", "stainless steel")
 */
export function deriveTwoTierFromText(keyword: string, rawUrl?: string): { tier1: string; tier2: string } {
  let clean = (keyword || '').toLowerCase().trim();

  // 1. Fallback to URL path slug if keyword is blank
  if (!clean && rawUrl) {
    try {
      const u = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
      const parts = decodeURIComponent(u.pathname).split('/').filter(Boolean);
      clean = (parts[parts.length - 1] || '')
        .replace(/\.(html?|php|aspx?|xml|json|pdf)$/i, '')
        .replace(/[-_+]+/g, ' ');
    } catch {}
  }

  // 2. Strip search intent prefixes
  clean = clean.replace(
    /^(best|top\s*\d*|review\s*of|reviews?\s*for|how\s*to\s*make|how\s*to|guide\s*to|what\s*is|why|where\s*to|compare|vs|huong\s*dan|danh\s*gia|cach\s*lam|cach|so\s*sanh|bang\s*gia|kinh\s*nghiem|mua|ban|top)\s+/i,
    ''
  );

  // 3. Strip trailing informational words & year tags
  clean = clean.replace(
    /\s+(reviews?|guide|specs|pricing|price|tutorial|manual|comparison|danh\s*gia|gia\s*bao\s*nhieu|tot\s*nhat|chinh\s*hang|gia\s*re|mua\s*o\s*dau|reddit|youtube|online|202\d|203\d)$/i,
    ''
  );

  // 4. Pure dimensions check (e.g. "10 x 15", "51 inch", "60cm")
  if (/^(\d+\s*x\s*\d+|\d+(\.\d+)?\s*(inch|inches|"|'|cm|mm|ft)?)$/i.test(clean.trim())) {
    return { tier1: 'General', tier2: 'Dimensions' };
  }

  // 5. Special feature phrases & specifications
  // "hot and cold" -> kitchen faucet feature spec
  clean = clean.replace(/\s+(hot\s*(and|&)\s*cold|cold\s*(and|&)\s*hot)\b.*/i, '');
  // "in ground" -> pool cover spec
  clean = clean.replace(/\s+in\s+ground\b.*/i, '');

  // Prepositional phrases containing the main product (e.g. "windows with integral blinds" -> "blinds")
  if (/windows?\s+with\s+(integral\s+)?blinds?/i.test(clean)) {
    return { tier1: 'Windows', tier2: 'Blinds' };
  }

  // Strip standard trailing prepositional clauses ("with pump", "with racks", "with built in...", "for beginners")
  clean = clean.replace(
    /\s+(with|for|under|over|without|by|from|cho|cua|tai|kem|co)\s+(built\s*in\s*)?.+$/i,
    ''
  );

  // Strip dimensions, measurements, and size keywords inside the string
  clean = clean.replace(/\b\d+\s*x\s*\d+\b/gi, '');
  clean = clean.replace(
    /\b\d+(\.\d+)?\s*(inch|inches|"|'|cm|mm|ft|feet|gallon|gal|oz|lbs?|kg|volt|v|watt|w|hp|cc|liter|l|mm|gpm|btu)\b/gi,
    ''
  );
  clean = clean.replace(/\b\d+\b/g, ''); // Standalone numbers (e.g. 60 in "60 linear fireplace")
  clean = clean.replace(/\b(queen|king|twin|full\s*size|california\s*king)\b/gi, '');
  clean = clean.replace(/\s+/g, ' ').trim();

  // 6. Explicit User Pattern: Food / Pet (e.g. "Food/Cat", "Food/Dog", "Food/Kitten")
  if (FOOD_PATTERN.test(clean) && PET_PATTERN.test(clean)) {
    const petMatch = clean.match(PET_PATTERN)?.[0]?.toLowerCase() || 'cat';
    return { tier1: 'Food', tier2: PET_MAP[petMatch] || 'Pet' };
  }

  // 7. Match against High-Precision Taxonomy Catalog
  for (const [category, subcategory, regex] of TAXONOMY_CATALOG) {
    if (regex.test(clean)) {
      return { tier1: category, tier2: subcategory };
    }
  }

  // 8. Room / Department recognition: if keyword starts or contains a prominent room name
  for (const [rmKey, rmCat] of Object.entries(ROOM_MAP)) {
    if (new RegExp(`\\b${rmKey}\\b`, 'i').test(clean)) {
      const remainder = clean.replace(new RegExp(`\\b${rmKey}\\b`, 'gi'), '').trim();
      const remWords = remainder.split(/\s+/).filter(Boolean);
      const sub = remWords.length > 0 ? capSingle(remWords[remWords.length - 1]) : 'General';
      return { tier1: rmCat, tier2: sub };
    }
  }

  // 9. Heuristic Fallback: Extract two core nouns by skipping common modifier words
  const rawWords = clean.split(/\s+/).filter(Boolean);
  let coreWords = rawWords.filter((w) => !MODIFIER_WORDS.has(w) && w.length > 1);
  if (coreWords.length < 2) {
    coreWords = rawWords.filter((w) => w.length > 1);
  }

  let t1 = '';
  let t2 = '';

  if (coreWords.length >= 2) {
    t1 = capSingle(coreWords[coreWords.length - 2]);
    t2 = capSingle(coreWords[coreWords.length - 1]);
  } else if (coreWords.length === 1) {
    t1 = capSingle(coreWords[0]);
    t2 = 'General';
  } else {
    t1 = 'General';
    t2 = 'Other';
  }

  return { tier1: t1, tier2: t2 };
}

/**
 * Format a list of items into TSV (Tab-Separated Values)
 * 2 Columns: Keyword [TAB] Phân nhóm (Cấp 1/Cấp 2)
 */
export function formatKeywordsAndGroupsTSV(
  items: Array<{ loc: string }>,
  includeHeader = true,
  options?: KeywordOptions
): string {
  const lines: string[] = [];
  if (includeHeader) {
    lines.push('Keyword\tPhân nhóm');
  }
  for (const item of items) {
    const { keyword, group } = extractKeywordAndGroup(item.loc, options);
    lines.push(`${keyword}\t${group}`);
  }
  return lines.join('\n');
}

/**
 * Format a list of items into TSV (3 Separate Columns)
 * Cột 1: Keyword [TAB] Cột 2: Cấp 1 [TAB] Cột 3: Cấp 2
 */
export function formatKeywords3ColumnsTSV(
  items: Array<{ loc: string }>,
  includeHeader = true,
  options?: KeywordOptions
): string {
  const lines: string[] = [];
  if (includeHeader) {
    lines.push('Keyword\tCấp 1\tCấp 2');
  }
  for (const item of items) {
    const { keyword, tier1, tier2 } = extractKeywordAndGroup(item.loc, options);
    lines.push(`${keyword}\t${tier1}\t${tier2}`);
  }
  return lines.join('\n');
}

/**
 * Format a list of items into standard CSV (2 columns)
 */
export function formatKeywordsAndGroupsCSV(
  items: Array<{ loc: string }>,
  includeHeader = true,
  options?: KeywordOptions
): string {
  const lines: string[] = [];
  if (includeHeader) {
    lines.push('"Keyword","Phân nhóm"');
  }
  for (const item of items) {
    const { keyword, group } = extractKeywordAndGroup(item.loc, options);
    const safeKw = keyword.replace(/"/g, '""');
    const safeGroup = group.replace(/"/g, '""');
    lines.push(`"${safeKw}","${safeGroup}"`);
  }
  return lines.join('\n');
}

/**
 * Format a list of items into standard CSV (3 separate columns: Keyword, Cấp 1, Cấp 2)
 */
export function formatKeywords3ColumnsCSV(
  items: Array<{ loc: string }>,
  includeHeader = true,
  options?: KeywordOptions
): string {
  const lines: string[] = [];
  if (includeHeader) {
    lines.push('"Keyword","Cấp 1","Cấp 2"');
  }
  for (const item of items) {
    const { keyword, tier1, tier2 } = extractKeywordAndGroup(item.loc, options);
    const safeKw = keyword.replace(/"/g, '""');
    const safeT1 = tier1.replace(/"/g, '""');
    const safeT2 = tier2.replace(/"/g, '""');
    lines.push(`"${safeKw}","${safeT1}","${safeT2}"`);
  }
  return lines.join('\n');
}
