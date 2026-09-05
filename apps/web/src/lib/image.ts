export function imgSrc(url: string): string {
  return url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL}${url}`;
}

/**
 * Next's built-in image optimizer (AVIF/WebP negotiation, resizing) can't
 * process SVGs safely by default, so those stay `unoptimized`. Real product
 * photography (JPG/PNG/WebP) goes through the optimizer normally — this is
 * what actually gets us modern-format LCP images.
 */
export function isSvg(url: string): boolean {
  return url.toLowerCase().endsWith(".svg");
}
