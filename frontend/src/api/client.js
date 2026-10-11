import axios from 'axios';

const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('lf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lf_token');
      localStorage.removeItem('lf_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;

// ---- Typed-ish helper wrappers used by pages ----
export const Api = {
  register: (data) => client.post('/auth/register', data).then((r) => r.data),
  login: (data) => client.post('/auth/login', data).then((r) => r.data),
  me: () => client.get('/auth/me').then((r) => r.data),

  airports: () => client.get('/airports').then((r) => r.data.airports),

  createLostItem: (formData) => client.post('/lost-items', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  getPhotoUrl: (key) => client.get('/files/signed-url', { params: { key } }).then((r) => r.data),
  getPhotoBlob: (key) => client.get(`/files/${key.split('/').map(encodeURIComponent).join('/')}`, { responseType: 'blob' }).then((r) => r.data),
  myLostItems: () => client.get('/lost-items').then((r) => r.data.items),
  searchLostItems: (params) => client.get('/lost-items', { params }).then((r) => r.data),
  getLostItem: (id) => client.get(`/lost-items/${id}`).then((r) => r.data.lostItem),
  getLostItemMatches: (id) => client.get(`/lost-items/${id}/matches`).then((r) => r.data.matches),

  createFoundItem: (formData) => client.post('/found-items', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  searchFoundItems: (params) => client.get('/found-items', { params }).then((r) => r.data),

  listMatches: (params) => client.get('/matches', { params }).then((r) => r.data),
  reviewMatch: (id, action, notes) => client.put(`/matches/${id}`, { action, notes }).then((r) => r.data),
  getMatchOwnershipVerification: (matchId) => client.get(`/matches/${matchId}/ownership-verification`).then((r) => r.data.ownershipVerification),

  getOwnershipVerification: (id) => client.get(`/ownership-verification/${id}`).then((r) => r.data.ownershipVerification),
  submitOwnershipProof: (id, formData) => client.put(`/ownership-verification/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  reviewOwnership: (id, approved, notes) => client.post(`/ownership-verification/${id}/review`, { approved, notes }).then((r) => r.data),
  markReturned: (id) => client.post(`/ownership-verification/${id}/mark-returned`).then((r) => r.data),

  notifications: (unreadOnly = false) => client.get('/notifications', { params: { unreadOnly } }).then((r) => r.data.notifications),
  markNotificationRead: (id) => client.put(`/notifications/${id}/read`).then((r) => r.data),

  passengerDashboard: () => client.get('/dashboard/passenger').then((r) => r.data),
  staffDashboard: () => client.get('/dashboard/staff').then((r) => r.data),
  adminDashboard: () => client.get('/dashboard/admin').then((r) => r.data),

  auditLogs: (params) => client.get('/audit-logs', { params }).then((r) => r.data),
  adminUsers: (params) => client.get('/admin/users', { params }).then((r) => r.data.users),
  setUserActive: (id, isActive) => client.put(`/admin/users/${id}/active`, { isActive }).then((r) => r.data),
  adminCreateUser: (data) => client.post('/auth/admin/create-user', data).then((r) => r.data),
};
