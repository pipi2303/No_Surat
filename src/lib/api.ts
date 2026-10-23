// In-memory token store (never stored in localStorage per security guidelines)
let memoryAuthToken: string | null = 'demo_session:demo-super-admin';
let activeDemoUidOverride: string | null = null;

export function setAuthToken(token: string | null, demoUid?: string | null) {
  memoryAuthToken = token;
  if (demoUid !== undefined) {
    activeDemoUidOverride = demoUid;
  }
}

export function getAuthToken(): string | null {
  return memoryAuthToken;
}

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (memoryAuthToken) {
    headers['Authorization'] = `Bearer ${memoryAuthToken}`;
  }
  if (activeDemoUidOverride) {
    headers['x-demo-uid'] = activeDemoUidOverride;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errMsg = `HTTP Error ${response.status}`;
    try {
      const errData = await response.json();
      if (errData.error) errMsg = errData.error;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errMsg);
  }

  return response.json();
}
