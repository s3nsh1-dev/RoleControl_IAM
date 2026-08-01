import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";
import { useAuthStore } from '@/store/auth'
import type { ApiErrorBody } from './types'

type RetrievableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

type SuccessEnvelope<T> = {
  success: true;
  message: string;
  data?: T;
  timestamp: string;
};

export class ApiClientError extends Error {
  statusCode: number;
  details?: ApiErrorBody["details"];
  retryAfter?: string;

  constructor(
    message: string,
    statusCode: number,
    body?: ApiErrorBody,
    retryAfter?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.details = body?.details;
    this.retryAfter = retryAfter;
  }
}

const api = axios.create({
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let refreshPromise: Promise<unknown> | null = null;

const isAuthEndpoint = (url = "") =>
  url.includes("/api/auth/login") || url.includes("/api/auth/refresh");

const refreshSession = () => {
  refreshPromise ??= axios
    .get("/api/auth/refresh", { withCredentials: true })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

api.interceptors.response.use(
  (response) => {
    const envelope = response.data as SuccessEnvelope<unknown>;

    if (envelope?.success === true) {
      return envelope.data;
    }

    return response.data;
  },
  async (error: AxiosError<ApiErrorBody>) => {
    const statusCode = error.response?.status ?? 0;
    const originalRequest = error.config as RetrievableRequest | undefined;
    const retryAfter = error.response?.headers?.["retry-after"];
    const retryAfterText = Array.isArray(retryAfter)
      ? retryAfter[0]
      : retryAfter;

    if (
      statusCode === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true;

      try {
        await refreshSession();
        return api(originalRequest);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.assign("/login");
      }
    }

    if (statusCode === 429) {
      const suffix = retryAfterText ? ` Try again in ${retryAfterText}s.` : "";
      toast.warning(
        `${error.response?.data?.message ?? "Too many requests."}${suffix}`,
      );
    }

    const message =
      error.response?.data?.message ?? error.message ?? "Request failed";

    return Promise.reject(
      new ApiClientError(
        message,
        statusCode,
        error.response?.data,
        retryAfterText,
      ),
    );
  },
);

export const request = <T>(config: AxiosRequestConfig) =>
  api.request<unknown, T>(config);

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";
