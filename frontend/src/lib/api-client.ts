import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach JWT
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 + token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== "/auth/login" &&
      originalRequest.url !== "/auth/refresh"
    ) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("No refresh token");
        }

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        }, {
          headers: {
            Authorization: `Bearer ${refreshToken}`,
          },
        });

        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        }

        return apiClient(originalRequest);
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// ───────────── API Functions ─────────────

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<{ accessToken: string; refreshToken: string }>("/auth/login", { email, password }),
  refresh: (refreshToken: string) =>
    apiClient.post<{ accessToken: string; refreshToken: string }>("/auth/refresh", { refreshToken }),
  logout: () => apiClient.post("/auth/logout"),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.patch<{ message: string }>("/auth/password", { currentPassword, newPassword }),
};

// Courses
export interface Course {
  id: string;
  title: string;
  description: string | null;
  udemyUrl: string;
  couponUrl: string;
  udemyCourseId: string | null;
  providerId: string;
  categoryId: string | null;
  language: string;
  thumbnailUrl: string | null;
  rating: number | null;
  instructor: string | null;
  priceOriginal: number | null;
  isFree: boolean;
  expiresAt: string | null;
  firstSeenAt: string;
  lastVerifiedAt: string;
  isActive: boolean;
  createdAt: string;
  provider?: Provider;
  category?: Category;
  _count?: {
    history: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CourseStats {
  totalCourses: number;
  activeCourses: number;
  expiringSoon: number;
  totalFavorites: number;
  activeSources: number;
}

export const coursesApi = {
  list: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<PaginatedResponse<Course>>("/courses", { params }),
  search: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<PaginatedResponse<Course>>("/courses/search", { params }),
  semanticSearch: (params?: Record<string, string | number | undefined>) =>
    apiClient.get<PaginatedResponse<Course>>("/courses/search/semantic", { params }),
  getById: (id: string) => apiClient.get<Course>(`/courses/${id}`),
  getStats: () => apiClient.get<CourseStats>("/courses/stats"),
  getRecommendations: () => apiClient.get<Course[]>("/courses/recommendations"),
  getSimilar: (id: string, limit = 4) =>
    apiClient.get<Course[]>(`/courses/${id}/similar`, { params: { limit } }),
};

// Providers
export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  isEnabled: boolean;
  timeoutMs: number;
  lastRunAt: string | null;
  lastStatus: "SUCCESS" | "FAILED" | "RUNNING" | "IDLE";
  createdAt: string;
}

export interface ProviderLog {
  id: string;
  providerId: string;
  jobId: string | null;
  status: "SUCCESS" | "FAILED" | "RUNNING" | "CANCELLED";
  message: string | null;
  coursesFound: number;
  coursesAccepted: number;
  coursesRejected: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface ProviderStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalCoursesFound: number;
  totalCoursesAccepted: number;
  totalCoursesRejected: number;
  successRate: number;
  lastRunAt: string | null;
}

export const providersApi = {
  list: () => apiClient.get<Provider[]>("/providers"),
  update: (id: string, data: Partial<Pick<Provider, "isEnabled" | "timeoutMs">>) =>
    apiClient.patch<Provider>(`/providers/${id}`, data),
  triggerScrape: (providerId?: string) =>
    apiClient.post("/providers/scrape", { providerId }),
  test: (id: string) => apiClient.post(`/providers/${id}/test`),
  retry: (id: string) => apiClient.post(`/providers/${id}/retry`),
  getLogs: (id: string, page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<ProviderLog>>(`/providers/${id}/logs`, { params: { page, limit } }),
  getStats: (id: string) => apiClient.get<ProviderStats>(`/providers/${id}/stats`),
};

// Favorites
export interface Favorite {
  id: string;
  userId: string;
  courseId: string;
  createdAt: string;
  course?: Course;
}

export const favoritesApi = {
  list: () => apiClient.get<Favorite[]>("/favorites"),
  add: (courseId: string) => apiClient.post<Favorite>("/favorites", { courseId }),
  remove: (courseId: string) => apiClient.delete(`/favorites/${courseId}`),
};

// History
export interface HistoryEntry {
  id: string;
  userId: string;
  courseId: string;
  action: "VIEWED" | "CLICKED" | "ENROLLED";
  createdAt: string;
  course?: Course;
}

export const historyApi = {
  list: (page = 1, limit = 20) =>
    apiClient.get<PaginatedResponse<HistoryEntry>>("/history", { params: { page, limit } }),
  record: (courseId: string, action: "VIEWED" | "CLICKED" | "ENROLLED") =>
    apiClient.post<HistoryEntry>("/history", { courseId, action }),
  clear: () => apiClient.delete<{ deleted: number }>("/history"),
};

// Analytics
export interface AnalyticsOverview {
  totalCourses: number;
  totalProviders: number;
  activeSources: number;
  totalScrapingRuns: number;
  successRate: number;
  coursesByCategory: { category: string; count: number }[];
  coursesByProvider: { provider: string; count: number }[];
}

export interface AnalyticsTimeSeries {
  coursesPerDay: { date: string; count: number }[];
  coursesByProviderPerDay: { date: string; provider: string; count: number }[];
  scrapingRunsPerDay: { date: string; success: number; failed: number }[];
  startDate: string;
  days: number;
}

export const analyticsApi = {
  getOverview: () => apiClient.get<AnalyticsOverview>("/analytics/overview"),
  getTimeSeries: (days: number = 30) =>
    apiClient.get<AnalyticsTimeSeries>("/analytics/time-series", { params: { days } }),
};

// Categories
export interface Category {
  id: string;
  name: string;
  slug: string;
}

export const categoriesApi = {
  list: () => apiClient.get<Category[]>("/categories"),
};

// Settings
export const settingsApi = {
  get: (key: string) => apiClient.get<{ key: string; value: string }>(`/settings/${key}`),
  update: (key: string, value: string) =>
    apiClient.patch<{ key: string; value: string }>(`/settings/${key}`, { value }),
};

