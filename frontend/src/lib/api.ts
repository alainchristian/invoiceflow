import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("if_token");
  const orgId = localStorage.getItem("if_org_id");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // A caller can pass its own X-Organization-Id (e.g. the admin portal acting
  // on a tenant it hasn't switched into) -- don't clobber an explicit value.
  if (orgId && !config.headers["X-Organization-Id"]) config.headers["X-Organization-Id"] = orgId;
  return config;
});

export default api;
