// ApiService — centralized API calls for backend integration
// In development, set VITE_API_URL=http://localhost:3000 in client/.env
const BASE_URL = import.meta.env.VITE_API_URL || "https://fairpay-production.up.railway.app";

async function handleResponse<T>(res: Response, method: string, endpoint: string): Promise<T> {
  if (!res.ok) {
    // Try to extract the actual error message from the backend
    try {
      const body = await res.json();
      throw new Error(body.error || body.message || `${method} ${endpoint} failed`);
    } catch (e: any) {
      if (e.message && e.message !== `${method} ${endpoint} failed`) throw e;
      throw new Error(`${method} ${endpoint} failed (${res.status})`);
    }
  }
  return res.json();
}

export const ApiService = {
  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    return handleResponse<T>(res, "GET", endpoint);
  },

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<T>(res, "POST", endpoint);
  },

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<T>(res, "PUT", endpoint);
  },

  async delete(endpoint: string): Promise<void> {
    const res = await fetch(`${BASE_URL}${endpoint}`, { method: "DELETE" });
    if (!res.ok) {
      try {
        const body = await res.json();
        throw new Error(body.error || body.message || `DELETE ${endpoint} failed`);
      } catch (e: any) {
        if (e.message) throw e;
        throw new Error(`DELETE ${endpoint} failed (${res.status})`);
      }
    }
  },
};
