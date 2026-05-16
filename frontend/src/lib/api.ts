import axios from "axios";

export const UNAUTHORIZED_EVENT = "stallion:unauthorized";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("stallion_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Only act when we *thought* we were authenticated.
      // Avoid hard redirects: they can create reload loops when some endpoints return 401.
      const token = localStorage.getItem("stallion_token");
      if (token) {
        localStorage.removeItem("stallion_token");
        localStorage.removeItem("stallion_user");
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(err);
  },
);

export default api;
