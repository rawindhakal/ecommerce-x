import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Only product/category detail paths are checked — these are the only
// places retired/merged URLs actually occur, so every other request skips
// this entirely.
export const config = {
  matcher: ["/products/:path*", "/categories/:path*"],
};

interface RedirectRule {
  fromPath: string;
  toPath: string | null;
  statusCode: number;
}

let cache: { data: RedirectRule[]; expiresAt: number } | null = null;

async function getRedirects(): Promise<RedirectRule[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";
  try {
    const res = await fetch(`${apiUrl}/api/redirects`);
    if (!res.ok) return cache?.data ?? [];
    const data = (await res.json()) as RedirectRule[];
    cache = { data, expiresAt: Date.now() + 60_000 };
    return data;
  } catch {
    return cache?.data ?? [];
  }
}

const GONE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>410 Gone</title></head>
<body style="font-family:system-ui;text-align:center;padding:80px 20px;color:#1A1A1A">
<h1 style="font-size:28px">This page has been permanently removed</h1>
<p style="color:#666">It won't be coming back — try the <a href="/products" style="color:#C2185B">full catalog</a> instead.</p>
</body></html>`;

export async function middleware(req: NextRequest) {
  const redirects = await getRedirects();
  const match = redirects.find((r) => r.fromPath === req.nextUrl.pathname);
  if (!match) return NextResponse.next();

  if (match.statusCode === 410 || !match.toPath) {
    return new NextResponse(GONE_HTML, { status: 410, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const url = req.nextUrl.clone();
  url.pathname = match.toPath;
  return NextResponse.redirect(url, match.statusCode === 302 ? 302 : 308);
}
