const TOKEN_KEY = 'hi_studio_token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the HttpOnly cookie still carries the session */
  }
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

/**
 * Fetch JSON from the Pages Functions API. Admin calls send the bearer token as well as the
 * session cookie; a 401 on an admin route fires `hi:unauthorized` so the app can return to login.
 */
export async function api<T>(path: string, { method = 'GET', body, form, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    credentials: 'same-origin',
    signal,
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/api/admin')) {
      window.dispatchEvent(new Event('hi:unauthorized'));
    }
    const serverMessage =
      data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : '';
    throw new ApiError(serverMessage || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

export const formatINR = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
