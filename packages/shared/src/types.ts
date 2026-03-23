export interface JobApplication {
  _id: string
  userId: string
  appliedAt: string
  company: string
  title: string
  platform: string
  status: string
  followUpAt: string | null
  link: string | null
  location: string | null
  workLocation: string | null
  jobType: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Settings {
  _id: string
  userId: string
  defaultPlatform: string
  defaultStatus: string
  followUpOffsetDays: number
  platformOptions: string[]
  locationOptions: string[]
  workLocationOptions: string[]
  defaultLocation: string
  defaultWorkLocation: string
}

export interface DashboardStats {
  applicationsToday: number
  applicationsThisWeek: number
  applicationsThisMonth: number
  interviewsCount: number
  responseRate: number
}

export interface ChartDataPoint {
  date: string
  count: number
}

export type ApplicationStatus = "Applied" | "Interview" | "Offer" | "Rejected" | "Withdrawn" | "No Response"

export const DEFAULT_STATUSES: ApplicationStatus[] = [
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "No Response",
]

export const DEFAULT_PLATFORMS = ["LinkedIn", "Wellfound", "Indeed", "Company Website", "Other"]

export const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Freelance"]

export const LOCATIONS = ["US", "EU", "Asia"]

export const WORK_LOCATIONS = ["Remote", "Hybrid", "Onsite"]

export interface ApplicationsQueryParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  platform?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  error?: string
}

export interface AuthResponse {
  token: string
  user: {
    id: string
    email: string
    name?: string
  }
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  name?: string
}
