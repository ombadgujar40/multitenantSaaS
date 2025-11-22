import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,  // single source of truth
});

export default api;
