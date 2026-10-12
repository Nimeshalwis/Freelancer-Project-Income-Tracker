import axios from 'axios';

// The Vite dev server proxies /api -> backend (see vite.config.js + .env.example),
// so the relative default works in development and same-origin production hosting.
export const API_BASE_URL = '/api';

const TOKEN_KEY = 'fit.token';

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Callback invoked when the API rejects the current token (401). Wired by AuthContext. */
let onUnauthenticated = null;
export const setUnauthenticatedHandler = (fn) => { onUnauthenticated = fn; };

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = tokenStorage.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // Only treat protected-resource 401s as session expiry; login/register failures are user-facing errors.
    const isAuthEndpoint = /\/auth\/(login|register)$/.test(error.config?.url || '');
    if (status === 401 && !isAuthEndpoint) onUnauthenticated?.();
    return Promise.reject(error);
  },
);

/** Extract a human-readable message from the backend error envelope `{ success:false, message, errors[] }`. */
export function getApiError(error) {
  const data = error?.response?.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const fieldErrors = Array.isArray(data.errors) ? data.errors : [];
    const message = typeof data.message === 'string' && data.message ? data.message : 'Request failed.';
    return { message, status: error.response?.status ?? 0, errors: fieldErrors };
  }
  const status = error?.response?.status ?? 0;
  if (error?.code === 'ERR_NETWORK' || [502, 503, 504].includes(status)) {
    return { message: 'Cannot reach the API server. Check that the backend is running and try again.', status, errors: [] };
  }
  return { message: 'Unexpected error. Please try again.', status: 0, errors: [] };
}

export const unwrap = (response) => response.data?.data;

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  me: () => api.get('/auth/me'),
};

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  monthlyIncome: (year) => api.get('/dashboard/monthly-income', year ? { params: { year } } : {}),
  projectStatus: () => api.get('/dashboard/project-status'),
};

// Generic CRUD per resource. Lists accept an optional plain params object (projects: status/client/search).
const crud = (path) => ({
  list: (params) => api.get(path, params ? { params } : {}).then(unwrap),
  get: (id) => api.get(`${path}/${id}`).then(unwrap),
  create: (body) => api.post(path, body).then(unwrap),
  update: (id, body) => api.patch(`${path}/${id}`, body).then(unwrap),
  remove: (id) => api.delete(`${path}/${id}`),
});

export const clientsApi = crud('/clients');
export const projectsApi = crud('/projects');
export const paymentsApi = crud('/payments');
