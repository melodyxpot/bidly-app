const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("bidly_token")
}

export function setToken(token: string) {
  localStorage.setItem("bidly_token", token)
}

export function removeToken() {
  localStorage.removeItem("bidly_token")
  localStorage.removeItem("bidly_user")
}

export function getStoredUser() {
  if (typeof window === "undefined") return null
  const user = localStorage.getItem("bidly_user")
  return user ? JSON.parse(user) : null
}

export function setStoredUser(user: any) {
  localStorage.setItem("bidly_user", JSON.stringify(user))
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

// Auth
export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Login failed")
  setToken(data.token)
  setStoredUser(data.user)
  return data
}

export async function apiRegister(email: string, password: string, name?: string) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Registration failed")
  setToken(data.token)
  setStoredUser(data.user)
  return data
}

export async function apiGetMe() {
  const res = await authFetch(`${API_BASE}/auth/me`)
  if (!res.ok) throw new Error("Not authenticated")
  return res.json()
}

// Applications
export async function apiGetApplications(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await authFetch(`${API_BASE}/applications?${query}`)
  if (!res.ok) throw new Error("Failed to fetch applications")
  return res.json()
}

export async function apiGetApplication(id: string) {
  const res = await authFetch(`${API_BASE}/applications/${id}`)
  if (!res.ok) throw new Error("Failed to fetch application")
  return res.json()
}

export async function apiCreateApplication(data: any) {
  const res = await authFetch(`${API_BASE}/applications`, {
    method: "POST",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to create application")
  return result
}

export async function apiUpdateApplication(id: string, data: any) {
  const res = await authFetch(`${API_BASE}/applications/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update application")
  return result
}

export async function apiDeleteApplication(id: string) {
  const res = await authFetch(`${API_BASE}/applications/${id}`, { method: "DELETE" })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to delete application")
  return result
}

export async function apiBulkCreateApplications(applications: any[]) {
  const res = await authFetch(`${API_BASE}/applications/bulk`, {
    method: "POST",
    body: JSON.stringify({ applications }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to bulk create")
  return result
}

// Dashboard
export async function apiGetDashboardStats() {
  const res = await authFetch(`${API_BASE}/dashboard/stats`)
  if (!res.ok) throw new Error("Failed to fetch stats")
  return res.json()
}

export async function apiGetChartData(days = 14) {
  const res = await authFetch(`${API_BASE}/dashboard/chart?days=${days}`)
  if (!res.ok) throw new Error("Failed to fetch chart data")
  return res.json()
}

// Settings
export async function apiGetSettings() {
  const res = await authFetch(`${API_BASE}/settings`)
  if (!res.ok) throw new Error("Failed to fetch settings")
  return res.json()
}

export async function apiUpdateSettings(data: any) {
  const res = await authFetch(`${API_BASE}/settings`, {
    method: "PUT",
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || "Failed to update settings")
  return result
}
