const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

/** For use in Server Components — public, unauthenticated GET requests only. */
export async function serverGet<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
