const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4100";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Zod's `err.flatten()` shape, as sent by the API's error handler for
// VALIDATION_ERROR responses: top-level issues plus one array per field.
interface ZodFlatten {
  formErrors?: string[];
  fieldErrors?: Record<string, string[]>;
}

function describeValidationError(message: string, details: unknown): string {
  const flat = details as ZodFlatten | undefined;
  const parts = [
    ...(flat?.formErrors ?? []),
    ...Object.entries(flat?.fieldErrors ?? {}).map(([field, errors]) => `${field}: ${errors.join(", ")}`),
  ];
  return parts.length > 0 ? `${message} — ${parts.join("; ")}` : message;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) },
    credentials: "include",
    cache: "no-store",
  });

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    let details: unknown;
    try {
      const body = await res.json();
      code = body.code;
      details = body.details;
      message = body.code === "VALIDATION_ERROR" ? describeValidationError(body.message ?? message, body.details) : body.message ?? message;
    } catch {
      // ignore — body wasn't JSON
    }
    throw new ApiError(res.status, message, code, details);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/uploads`, { method: "POST", body: formData, credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "Upload failed");
  const data = await res.json();
  return data.url as string;
}

export { API_URL };
