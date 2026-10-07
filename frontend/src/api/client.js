// Shared API client (plan §10). Single place for base URL, the fake
// user header, and the backend envelope { success, data } / errors.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:5005').replace(/\/$/, '');
const USER_ID = import.meta.env.VITE_USER_ID ?? '123';

export function apiUrl(path = '') {
  return `${API_URL}${path}`;
}

export function imageUrl(relativePath) {
  if (!relativePath) return null;
  return new URL(relativePath, `${API_URL}/`).href;
}

export async function request(path, { method = 'GET', body, form } = {}) {
  const res = await fetch(apiUrl(path), {
    method,
    headers: {
      'x-user-id': USER_ID,
      ...(form ? {} : { 'Content-Type': 'application/json' }),
    },
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Request failed (${res.status})`);
  }

  if (!json.success) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }
  return json.data;
}

export const getHealth = () => request('/api/health');
