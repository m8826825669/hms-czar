// frontend/src/lib/api/client.ts
//
// Lightweight axios-compatible HTTP client backed by fetch.
// Matches the .get / .post / .patch / .put / .delete shape used by
// all api/*.ts modules: returns { data, status }.

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000/api/v1";

interface QueryParams {
  [key: string]: string | number | boolean | undefined | null;
}

interface RequestOptions {
  params?: QueryParams;
  headers?: Record<string, string>;
}

interface ApiResponse<T> {
  data: T;
  status: number;
}


function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}


function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.append(k, String(v));
      }
    });
  }
  return url.toString();
}


async function request<T>(
  method: string,
  path: string,
  opts: {
    body?: unknown;
    params?: QueryParams;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResponse<T>> {
  const url = buildUrl(path, opts.params);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(opts.headers || {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  });

  // Parse response body based on content-type
  let data: any = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    data = await res.json();
  } else if (res.status !== 204) {
    const text = await res.text();
    data = text;
  }

  if (!res.ok) {
    const err: any = new Error(
      data?.detail || data?.message || `HTTP ${res.status}`,
    );
    err.response = { status: res.status, data };
    throw err;
  }

  return { data: data as T, status: res.status };
}


export const apiClient = {
  get: <T>(path: string, opts: RequestOptions = {}) =>
    request<T>("GET", path, { params: opts.params, headers: opts.headers }),

  post: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>("POST", path, {
      body, params: opts.params, headers: opts.headers,
    }),

  patch: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>("PATCH", path, {
      body, params: opts.params, headers: opts.headers,
    }),

  put: <T>(path: string, body?: unknown, opts: RequestOptions = {}) =>
    request<T>("PUT", path, {
      body, params: opts.params, headers: opts.headers,
    }),

  delete: <T>(path: string, opts: RequestOptions = {}) =>
    request<T>("DELETE", path, { params: opts.params, headers: opts.headers }),
};