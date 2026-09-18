// Best-effort keyword → swatch color for shade/color variant options, so
// e.g. "Nude 02" or "Ruby Red 05" render as a color dot instead of just
// text. Product data has no hex field, so this is a heuristic, not exact —
// falls back to a neutral dot (still labeled by name) when nothing matches.
const KEYWORD_COLORS: [RegExp, string][] = [
  [/\bblack\b/i, "#1a1a1a"],
  [/\bwhite\b|\bivory\b/i, "#f8f4ef"],
  [/\bnude\b|\bbeige\b|\bsand\b|\btan\b/i, "#d8b48c"],
  [/\bred\b|\bruby\b|\bcrimson\b|\bscarlet\b/i, "#c0392b"],
  [/\bpink\b|\bblush\b|\brose\b|\bmauve\b/i, "#e8a0b4"],
  [/\bcoral\b|\bpeach\b/i, "#f08a5d"],
  [/\borange\b/i, "#e67e22"],
  [/\byellow\b|\bgold\b/i, "#e5c23a"],
  [/\bbrown\b|\bchocolate\b|\bcocoa\b|\bmocha\b/i, "#6f4e37"],
  [/\bmaroon\b|\bwine\b|\bberry\b/i, "#7b1f2b"],
  [/\bpurple\b|\bviolet\b|\blilac\b|\bplum\b/i, "#8e5b9e"],
  [/\bblue\b|\bnavy\b/i, "#2c5f8a"],
  [/\bgreen\b|\bolive\b|\bmint\b/i, "#4a7a52"],
  [/\bgrey\b|\bgray\b|\bsilver\b/i, "#9a9a9a"],
];

export function colorForOption(value: string): string | null {
  for (const [pattern, hex] of KEYWORD_COLORS) {
    if (pattern.test(value)) return hex;
  }
  return null;
}

/** Option keys treated as visual/color swatches rather than plain text pills. */
export const SWATCH_KEYS = new Set(["shade", "color", "colour"]);
