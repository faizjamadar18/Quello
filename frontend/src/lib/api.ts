import { auth } from './auth';
import { API_BASE_URL } from './config';

function parseErrorDetail(detail: unknown): string {
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d === 'object' && d && 'msg' in d ? d.msg : String(d))).join(', ');
  }
  if (typeof detail === 'string') {
    return detail;
  }
  return 'API Request Failed';
}

export interface ApiRequestOptions extends RequestInit {
  /**
   * Set for background auth probes (e.g. session verification on the
   * landing page). A 401 there just means "signed out" — it must not
   * force-navigate the whole page to /login.
   */
  skipAuthRedirect?: boolean;
}

/**
 * Typed request failure. `status` lets callers separate a definitive
 * auth rejection (401/403 → sign out) from transient trouble (0 network /
 * 5xx cold start → keep the session, retry), which the plain string error
 * used to make impossible.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const api = {
  async request(endpoint: string, options: ApiRequestOptions = {}) {
    const { skipAuthRedirect, ...fetchOptions } = options;
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    if (fetchOptions.body instanceof FormData) {
      delete headers['Content-Type'];
    }

    const token = auth.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401) {
        // Definitive sign-out: clear storage + cookie mirror together, and
        // carry the deep link along so sign-in can return to this page.
        auth.removeToken();
        if (!skipAuthRedirect && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${next}`;
        }
      }
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(parseErrorDetail(errorData.detail), status);
    }

    if (response.status === 204) {
        return null;
    }
    
    return response.json();
  },

  get(endpoint: string, options?: ApiRequestOptions) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },

  post(endpoint: string, body: unknown, options?: ApiRequestOptions) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  put(endpoint: string, body: unknown, options?: ApiRequestOptions) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  patch(endpoint: string, body: unknown, options?: ApiRequestOptions) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: isFormData ? body : JSON.stringify(body),
    });
  },

  delete(endpoint: string, options?: ApiRequestOptions) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  },

  uploadWithProgress<T = unknown>(
    endpoint: string,
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}${endpoint}`);
      const token = auth.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
          onProgress(percent);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(xhr.responseText as unknown as T);
          }
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            reject(new Error(parseErrorDetail(errJson.detail)));
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  },
};
