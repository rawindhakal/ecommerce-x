/** Converts a "#rrggbb" hex color into a "r g b" channel string for Tailwind's rgb(var(--x) / alpha) pattern. */
export function hexToRgbChannels(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback;
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return fallback;
  const [, r, g, b] = match;
  return `${parseInt(r!, 16)} ${parseInt(g!, 16)} ${parseInt(b!, 16)}`;
}
