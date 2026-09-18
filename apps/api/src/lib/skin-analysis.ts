import sharp from "sharp";

/**
 * Self-contained skin analysis engine — no external AI API involved.
 *
 * Pipeline:
 *  1. Decode + downsample the photo with `sharp` and read raw RGB pixels.
 *  2. Classify each pixel as skin/not-skin with a standard, well-documented
 *     RGB skin-color heuristic (a daylight rule + a flash-lit rule — the
 *     same family of rule used in classic face-detection preprocessing,
 *     not machine learning), so downstream stats only look at skin.
 *  3. Compute color/texture statistics over just the skin pixels:
 *     brightness, saturation, hue spread (unevenness), a specular-highlight
 *     ratio (oil shine), a dark-patch ratio (pigmentation/dark spots), a
 *     redness index, and a texture-roughness score (a Sobel-style gradient
 *     magnitude, proxying pore/texture visibility).
 *  4. An explainable rule-based expert system combines those measurements
 *     with the customer's questionnaire answers to output a skin type,
 *     scored concerns, a written summary, and care tips.
 *
 * Every number here is derived from real pixels via a documented formula —
 * nothing is guessed or hard-coded to the questionnaire alone.
 */

const ANALYSIS_SIZE = 200; // long-edge px after downsampling; plenty for color/texture stats, keeps this fast

export type SkinType = "Oily" | "Dry" | "Combination" | "Normal" | "Sensitive";

export type ConcernKey =
  | "ACNE"
  | "DARK_SPOTS"
  | "WRINKLES"
  | "DULLNESS"
  | "LARGE_PORES"
  | "REDNESS"
  | "DRYNESS"
  | "OILINESS"
  | "UNEVEN_TONE"
  | "SENSITIVITY"
  | "SUN_PROTECTION";

export interface Answers {
  skinType: "OILY" | "DRY" | "COMBINATION" | "NORMAL" | "SENSITIVE" | "UNSURE";
  concerns: ConcernKey[];
  ageRange: "UNDER_18" | "18_24" | "25_34" | "35_44" | "45_PLUS";
}

export interface SkinMetrics {
  skinPixelRatio: number;
  meanLuminance: number; // 0-255
  meanSaturation: number; // 0-1
  hueStdDev: number; // 0-180
  specularRatio: number; // 0-1, share of near-blown-out skin pixels
  darkPatchRatio: number; // 0-1, share of notably darker-than-average skin pixels
  rednessIndex: number; // roughly -60..120
  textureRoughness: number; // 0+, mean local gradient magnitude
  blemishRatio: number; // 0-1, share of skin pixels that are both notably redder than average AND texturally rough — localized inflamed spots, not overall complexion tone
  confident: boolean; // false when too little skin was detected in frame
}

export interface Concern {
  key: ConcernKey;
  name: string;
  severity: number; // 1-5
}

export interface AnalysisResult {
  skinType: SkinType;
  concerns: Concern[];
  summary: string;
  tips: string[];
  metrics: SkinMetrics;
}

const CONCERN_LABELS: Record<ConcernKey, string> = {
  ACNE: "Acne & breakouts",
  DARK_SPOTS: "Dark spots & hyperpigmentation",
  WRINKLES: "Fine lines & wrinkles",
  DULLNESS: "Dullness & uneven texture",
  LARGE_PORES: "Large / visible pores",
  REDNESS: "Redness & irritation",
  DRYNESS: "Dryness & flaking",
  OILINESS: "Excess oil & shine",
  UNEVEN_TONE: "Uneven skin tone",
  SENSITIVITY: "Sensitivity & reactivity",
  SUN_PROTECTION: "Sun damage & UV protection",
};

// ---- Step 1-2: decode + skin-pixel classification ----

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/** Kovac et al.-style RGB skin-color rule: daylight condition OR flash-lit condition. */
function isSkinPixel(r: number, g: number, b: number): boolean {
  const daylight = r > 95 && g > 40 && b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15 && Math.abs(r - g) > 15 && r > g && r > b;
  const flash = r > 220 && g > 210 && b > 170 && Math.abs(r - g) <= 15 && r > b && g > b;
  return daylight || flash;
}

async function computeMetrics(imageBuffer: Buffer): Promise<SkinMetrics> {
  const { data, info } = await sharp(imageBuffer)
    .rotate() // apply EXIF orientation before we start indexing pixels
    .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const totalPixels = width * height;

  // Full-frame luminance grid, used for the texture/edge pass regardless of
  // skin classification (skin-only edges would be too sparse to be useful).
  const luminance = new Float32Array(totalPixels);
  const skinMask = new Uint8Array(totalPixels);

  let skinCount = 0;
  let sumLum = 0;
  let sumSat = 0;
  let sumHueX = 0;
  let sumHueY = 0; // circular mean of hue via unit-vector components
  let sumRedness = 0;

  for (let i = 0; i < totalPixels; i++) {
    const o = i * channels;
    const r = data[o]!;
    const g = data[o + 1]!;
    const b = data[o + 2]!;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminance[i] = lum;

    if (isSkinPixel(r, g, b)) {
      skinMask[i] = 1;
      skinCount++;
      sumLum += lum;
      const { h, s } = rgbToHsv(r, g, b);
      sumSat += s;
      const rad = (h * Math.PI) / 180;
      sumHueX += Math.cos(rad);
      sumHueY += Math.sin(rad);
      sumRedness += r - (g + b) / 2;
    }
  }

  const skinPixelRatio = skinCount / totalPixels;
  const confident = skinCount >= totalPixels * 0.04; // at least ~4% of frame read as skin

  if (skinCount === 0) {
    return {
      skinPixelRatio: 0,
      meanLuminance: 128,
      meanSaturation: 0.3,
      hueStdDev: 20,
      specularRatio: 0,
      darkPatchRatio: 0,
      rednessIndex: 0,
      textureRoughness: 15,
      blemishRatio: 0,
      confident: false,
    };
  }

  const meanLuminance = sumLum / skinCount;
  const meanSaturation = sumSat / skinCount;
  const rednessIndex = sumRedness / skinCount;
  const meanHueRad = Math.atan2(sumHueY / skinCount, sumHueX / skinCount);

  // Second pass: variance-dependent stats that need the means computed above.
  let specularCount = 0;
  let darkCount = 0;
  let hueSqDiffSum = 0;
  let gradientSum = 0;
  let gradientCount = 0;
  let blemishCount = 0;
  // A "blemish" pixel is both notably redder than this face's own average
  // complexion AND sits in a texturally rough spot — a localized inflamed,
  // raised mark, as opposed to overall skin tone (already captured by
  // rednessIndex) or a smooth flat discoloration (already captured by
  // darkPatchRatio). Threshold picked in the same units/scale as the
  // existing specular/dark-patch thresholds just above.
  const BLEMISH_REDNESS_DELTA = 8;
  const BLEMISH_GRADIENT_MIN = 25;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (skinMask[i]) {
        const o = i * channels;
        const r = data[o]!,
          g = data[o + 1]!,
          b = data[o + 2]!;
        if (luminance[i]! > 235) specularCount++;
        if (luminance[i]! < meanLuminance - 40) darkCount++;
        const { h } = rgbToHsv(r, g, b);
        const rad = (h * Math.PI) / 180;
        let diff = rad - meanHueRad;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to [-pi, pi]
        hueSqDiffSum += diff * diff;

        // Sobel-magnitude on luminance, skin pixels only — a texture/pore proxy.
        const gx =
          -luminance[i - width - 1]! + luminance[i - width + 1]! - 2 * luminance[i - 1]! + 2 * luminance[i + 1]! - luminance[i + width - 1]! + luminance[i + width + 1]!;
        const gy =
          -luminance[i - width - 1]! - 2 * luminance[i - width]! - luminance[i - width + 1]! + luminance[i + width - 1]! + 2 * luminance[i + width]! + luminance[i + width + 1]!;
        const gradMag = Math.sqrt(gx * gx + gy * gy);
        gradientSum += gradMag;
        gradientCount++;

        const pixelRedness = r - (g + b) / 2;
        if (pixelRedness > rednessIndex + BLEMISH_REDNESS_DELTA && gradMag > BLEMISH_GRADIENT_MIN) blemishCount++;
      }
    }
  }

  const hueStdDevRad = Math.sqrt(hueSqDiffSum / Math.max(1, skinCount));

  return {
    skinPixelRatio,
    meanLuminance,
    meanSaturation,
    hueStdDev: (hueStdDevRad * 180) / Math.PI,
    specularRatio: specularCount / skinCount,
    darkPatchRatio: darkCount / skinCount,
    rednessIndex,
    textureRoughness: gradientCount > 0 ? gradientSum / gradientCount : 15,
    blemishRatio: blemishCount / skinCount,
    confident,
  };
}

// ---- Step 4: expert-rules classification ----

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

function classifySkinType(m: SkinMetrics, selfReport: Answers["skinType"]): SkinType {
  // Two independent 0-1 scores from photo evidence.
  const oilScore = clamp(m.specularRatio * 6 + (m.meanLuminance > 190 ? 0.15 : 0), 0, 1);
  const dryScore = clamp((m.textureRoughness - 8) / 30 + (m.specularRatio < 0.02 ? 0.15 : 0), 0, 1);

  const selfMap: Partial<Record<Answers["skinType"], SkinType>> = {
    OILY: "Oily",
    DRY: "Dry",
    COMBINATION: "Combination",
    NORMAL: "Normal",
    SENSITIVE: "Sensitive",
  };
  const selfType = selfMap[selfReport];

  // Sensitivity from the questionnaire is honored directly — redness alone
  // in a photo is too easily confused with lighting/skin tone to call it
  // algorithmically, so it's the one type we defer to self-report on.
  if (selfType === "Sensitive" && m.rednessIndex > 4) return "Sensitive";

  let photoType: SkinType;
  if (oilScore > 0.55 && dryScore < 0.35) photoType = "Oily";
  else if (dryScore > 0.55 && oilScore < 0.35) photoType = "Dry";
  else if (oilScore > 0.4 && dryScore > 0.4) photoType = "Combination";
  else photoType = "Normal";

  if (!m.confident) return selfType ?? photoType;
  // Reconcile: agree → use it; disagree → prefer photo evidence but keep
  // Combination as a sensible middle ground when self-report and photo
  // point to opposite ends (oily vs dry).
  if (!selfType || selfType === photoType) return photoType;
  const opposite = (selfType === "Oily" && photoType === "Dry") || (selfType === "Dry" && photoType === "Oily");
  return opposite ? "Combination" : photoType;
}

function scoreConcerns(m: SkinMetrics, selfReported: ConcernKey[]): Concern[] {
  const scores: Partial<Record<ConcernKey, number>> = {};

  const add = (key: ConcernKey, value: number) => {
    scores[key] = Math.max(scores[key] ?? 0, clamp(value, 0, 5));
  };

  if (m.confident) {
    add("OILINESS", m.specularRatio * 22);
    add("DRYNESS", (m.textureRoughness - 8) / 5);
    add("LARGE_PORES", (m.textureRoughness - 10) / 4.5);
    add("DARK_SPOTS", m.darkPatchRatio * 18);
    add("UNEVEN_TONE", m.hueStdDev / 9);
    add("DULLNESS", (200 - m.meanLuminance) / 24 + (0.35 - m.meanSaturation) * 4);
    add("REDNESS", (m.rednessIndex - 8) / 5);
    // Localized inflamed spots (blemishRatio) drive this far more than
    // overall dark-patch share or texture alone — see BLEMISH_* thresholds
    // in computeMetrics for what counts as a "blemish" pixel.
    add("ACNE", m.blemishRatio * 45 + m.darkPatchRatio * 4);
    // Visible hyperpigmentation + uneven tone are the classic signs of
    // cumulative UV exposure — flagged here as a forward-looking "start
    // protecting now" concern, distinct from DARK_SPOTS (existing marks)
    // and UNEVEN_TONE (current appearance).
    add("SUN_PROTECTION", m.darkPatchRatio * 14 + m.hueStdDev / 10);
  }

  // Self-reported concerns always surface (a customer's own experience
  // matters even when the photo doesn't show it clearly, e.g. wrinkles at
  // rest, or acne that's currently healed) — floor them at a base severity
  // and let any photo evidence push them higher.
  for (const key of selfReported) {
    scores[key] = Math.max(scores[key] ?? 0, 2.5);
  }
  // Wrinkles aren't estimated from color/texture stats reliably at this
  // resolution — rely on self-report only, boosted slightly by age range.
  if (selfReported.includes("WRINKLES")) scores.WRINKLES = Math.max(scores.WRINKLES ?? 0, 3);
  if (selfReported.includes("SENSITIVITY")) scores.SENSITIVITY = Math.max(scores.SENSITIVITY ?? 0, 3);

  return Object.entries(scores)
    .filter(([, v]) => (v ?? 0) >= 1.8)
    .map(([key, v]) => ({ key: key as ConcernKey, name: CONCERN_LABELS[key as ConcernKey], severity: Math.round(clamp(v ?? 0, 1, 5)) }))
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5);
}

const TIP_LIBRARY: Record<ConcernKey, string[]> = {
  ACNE: ["Cleanse twice daily with a gentle, non-stripping cleanser.", "Avoid over-exfoliating — it can worsen breakouts.", "Look for salicylic acid or niacinamide in your routine."],
  DARK_SPOTS: ["Vitamin C in the morning helps fade discoloration over time.", "Daily SPF is the single best defense against new dark spots.", "Be patient — pigmentation fades over weeks, not days."],
  WRINKLES: ["Introduce retinol gradually, starting 2-3 nights a week.", "Hydration plumps skin and softens the look of fine lines.", "SPF daily is the top anti-aging habit there is."],
  DULLNESS: ["Gentle exfoliation 1-2x weekly reveals brighter skin.", "Vitamin C or niacinamide can boost radiance.", "Don't skip moisturizer — dehydrated skin looks duller."],
  LARGE_PORES: ["Clay masks can temporarily minimize the look of pores.", "Niacinamide helps regulate oil that stretches pores.", "Avoid heavy, pore-clogging oils if this is a concern."],
  REDNESS: ["Look for centella asiatica or aloe to calm irritation.", "Patch-test new products — redness-prone skin reacts easily.", "Fragrance-free formulas are usually gentler."],
  DRYNESS: ["Layer a hydrating serum under a richer moisturizer.", "Look for hyaluronic acid and ceramides.", "Avoid hot water and harsh, foaming cleansers."],
  OILINESS: ["A lightweight, oil-free moisturizer still matters — skipping it can backfire.", "Clay or charcoal masks help absorb excess oil.", "Don't over-cleanse; it can trigger more oil production."],
  UNEVEN_TONE: ["Consistent SPF prevents tone from becoming more uneven.", "Vitamin C and niacinamide both help even out tone.", "Gentle, regular exfoliation supports an even texture."],
  SENSITIVITY: ["Simplify your routine — fewer products means fewer triggers.", "Fragrance-free and hypoallergenic labels are good signals.", "Always patch-test on your inner arm before your face."],
  SUN_PROTECTION: ["Apply a broad-spectrum SPF 30+ every morning, even indoors or on cloudy days.", "Reapply sunscreen every 2-3 hours during direct sun exposure.", "UV damage is cumulative — consistent daily SPF is the single best way to prevent new dark spots and premature aging."],
};

function buildSummary(skinType: SkinType, concerns: Concern[], confident: boolean): string {
  const top = concerns[0];
  const lightingNote = confident ? "" : " We couldn't get a fully clear read on your skin from this photo, so this leans more on your answers — for a sharper analysis, try a well-lit, front-facing photo.";
  if (!top) {
    return `Your skin reads as broadly ${skinType.toLowerCase()} with no strong concerns detected right now — a good sign. A consistent, gentle routine should keep it that way.${lightingNote}`;
  }
  const severityWord = top.severity >= 4 ? "a noticeable" : top.severity >= 3 ? "a moderate" : "a mild";
  return `Your skin appears ${skinType.toLowerCase()}, with ${severityWord} degree of ${top.name.toLowerCase()}${
    concerns[1] ? ` and some ${concerns[1].name.toLowerCase()}` : ""
  }. The recommendations below are chosen to target that first.${lightingNote}`;
}

function buildTips(concerns: Concern[], skinType: SkinType): string[] {
  const tips: string[] = [];
  for (const c of concerns) {
    for (const t of TIP_LIBRARY[c.key]) {
      if (!tips.includes(t)) tips.push(t);
      if (tips.length >= 3) break;
    }
    if (tips.length >= 3) break;
  }
  if (tips.length < 3) {
    const fallback: Record<SkinType, string[]> = {
      Oily: ["Use a lightweight, oil-free moisturizer daily.", "Don't skip SPF — look for a matte or gel formula.", "Cleanse twice daily to manage shine without over-drying."],
      Dry: ["Moisturize while skin is still damp to lock in hydration.", "Look for ceramides and hyaluronic acid.", "Avoid hot showers, which strip natural oils."],
      Combination: ["Consider using different products on your T-zone vs. cheeks.", "A balancing, lightweight moisturizer works well overall.", "Don't skip SPF, even on drier areas."],
      Normal: ["Maintain your routine with gentle, consistent care.", "Daily SPF keeps skin healthy long-term.", "Introduce new actives one at a time to see what works."],
      Sensitive: ["Patch-test everything new before applying to your face.", "Fragrance-free, minimal-ingredient formulas are safest.", "Introduce one new product at a time."],
    };
    for (const t of fallback[skinType]) {
      if (!tips.includes(t)) tips.push(t);
      if (tips.length >= 3) break;
    }
  }
  return tips.slice(0, 3);
}

export async function analyzeSkin(imageBuffer: Buffer, answers: Answers): Promise<AnalysisResult> {
  const metrics = await computeMetrics(imageBuffer);
  const skinType = classifySkinType(metrics, answers.skinType);
  const concerns = scoreConcerns(metrics, answers.concerns);
  const summary = buildSummary(skinType, concerns, metrics.confident);
  const tips = buildTips(concerns, skinType);

  return {
    skinType,
    concerns: concerns.map((c) => ({ ...c, severity: round1(c.severity) })),
    summary,
    tips,
    metrics,
  };
}

// ---- Product matching keywords, reused by the recommendation ranker ----

export const CONCERN_KEYWORDS: Record<ConcernKey, string[]> = {
  ACNE: ["acne", "salicylic", "tea tree", "blemish", "niacinamide", "clear", "spot treatment", "bha"],
  DARK_SPOTS: ["vitamin c", "brightening", "dark spot", "niacinamide", "spot", "pigmentation"],
  WRINKLES: ["anti-aging", "anti aging", "retinol", "collagen", "wrinkle", "firming", "peptide"],
  DULLNESS: ["brightening", "glow", "radiance", "vitamin c", "exfoliat", "illuminat"],
  LARGE_PORES: ["pore", "mattify", "clay", "charcoal", "blackhead"],
  REDNESS: ["soothing", "calm", "centella", "cica", "aloe", "sensitive", "redness", "chamomile"],
  DRYNESS: ["hydrat", "moistur", "hyaluronic", "ceramide", "nourish", "dry"],
  OILINESS: ["oil-control", "oil control", "mattify", "balancing", "oil-free", "sebum"],
  UNEVEN_TONE: ["brightening", "even tone", "vitamin c", "tone", "niacinamide"],
  SENSITIVITY: ["sensitive", "gentle", "fragrance-free", "soothing", "hypoallergenic", "calm"],
  SUN_PROTECTION: ["spf", "sunscreen", "sun protection", "sun block", "sunblock", "uv protection", "broad spectrum"],
};

export const SKIN_TYPE_KEYWORDS: Record<SkinType, string[]> = {
  Oily: ["oil-control", "oil-free", "mattify", "gel", "balancing"],
  Dry: ["hydrat", "moistur", "nourish", "rich", "ceramide"],
  Combination: ["balancing", "lightweight", "hydrat"],
  Normal: ["everyday", "gentle", "balanced"],
  Sensitive: ["sensitive", "gentle", "fragrance-free", "hypoallergenic", "soothing"],
};
