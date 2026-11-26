const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'sweety_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || {};
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Could not reach the server. Please try again.', 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong.', res.status, data.errors);
  return data;
}

export const api = {
  signup: (b) => request('/auth/signup', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  me: () => request('/auth/me'),
  listReadings: ({ page = 1, limit = 10 } = {}) => request(`/readings?page=${page}&limit=${limit}`),
  createReading: (b) => request('/readings', { method: 'POST', body: b }),
  updateReading: (id, b) => request(`/readings/${id}`, { method: 'PUT', body: b }),
  deleteReading: (id) => request(`/readings/${id}`, { method: 'DELETE' }),
  report: (type, date) => request(`/reports?type=${type}&date=${date}`),
};
