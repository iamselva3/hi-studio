import { ApiError, getToken } from '@/lib/api';

/**
 * Multipart POST with upload progress (fetch cannot report it). Sends the bearer token like `api()`
 * and fires `hi:unauthorized` on a 401 so the admin returns to the sign-in page.
 */
export function uploadWithProgress<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', path);
    xhr.withCredentials = true;
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onerror = () => reject(new TypeError('Network error'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.onload = () => {
      let data: unknown = null;
      if (xhr.responseText) {
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          data = xhr.responseText;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data as T);
        return;
      }
      if (xhr.status === 401 && path.startsWith('/api/admin')) window.dispatchEvent(new Event('hi:unauthorized'));
      let message = xhr.status === 413 ? 'That file is too large.' : `Upload failed (${xhr.status})`;
      if (data && typeof data === 'object' && 'error' in data) {
        const serverMessage = String((data as { error: unknown }).error || '');
        if (serverMessage) message = serverMessage;
      }
      reject(new ApiError(message, xhr.status));
    };
    xhr.send(form);
  });
}
