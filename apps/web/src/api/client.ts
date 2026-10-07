export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown> | unknown[];

export async function api<T>(path: string, init: { method?: string; body?: Json; keepalive?: boolean; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      credentials: "same-origin",
      headers: init.body ? { "content-type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      keepalive: init.keepalive,
      signal: init.signal,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "网络连接失败，请检查网络后重试");
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "HTTP_" + res.status, err?.message ?? `请求失败（${res.status}）`);
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "出了点问题，请稍后再试";
}
