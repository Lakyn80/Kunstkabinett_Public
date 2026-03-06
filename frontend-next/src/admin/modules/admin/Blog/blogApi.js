// apps/admin/src/modules/admin/Blog/blogApi.js
import api from "../../../shared/adminApiClient.js";

const BASE = "/api/admin/v1/blog";

const blogApi = {
  list(params = {}) {
    return api.get(`${BASE}/`, { params });
  },
  async get(id) {
    const res = await api.get(`${BASE}/${String(id).trim()}`);
    return res.data;
  },
  create(payload) {
    return api.post(`${BASE}/`, payload);
  },
  update(id, payload) {
    const sid = String(id).trim();
    const clean = {};
    for (const [k, v] of Object.entries(payload || {})) {
      if (v !== undefined) clean[k] = v;
    }
    return api.patch(`${BASE}/${sid}`, clean);
  },
  remove(id) {
    return api.delete(`${BASE}/${String(id).trim()}`);
  },
  publish(id) {
    return api.post(`${BASE}/${String(id).trim()}/publish`);
  },
  unpublish(id) {
    return api.post(`${BASE}/${String(id).trim()}/unpublish`);
  },
};

export default blogApi;
