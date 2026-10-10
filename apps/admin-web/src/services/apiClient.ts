import axios, { AxiosError, AxiosInstance } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
let authTokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null): void {
  authTokenProvider = provider;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await authTokenProvider?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

export interface ApiErrorPayload {
  message: string;
  statusCode: number;
  code?: string;
  isNetworkError?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; error?: string }>) => {
    let customError: ApiErrorPayload = {
      message: 'An unexpected network error occurred.',
      statusCode: 500,
      isNetworkError: !error.response,
    };

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          customError = {
            message: 'Session expired or unauthenticated. Please re-authenticate.',
            statusCode: 401,
            code: 'UNAUTHORIZED',
          };
          break;
        case 403:
          customError = {
            message: 'Access denied: You do not have permission to access aggregate analytics.',
            statusCode: 403,
            code: 'FORBIDDEN',
          };
          break;
        case 404:
          customError = {
            message: 'Requested analytics endpoint was not found on backend.',
            statusCode: 404,
            code: 'NOT_FOUND',
          };
          break;
        case 429:
          customError = {
            message: 'Rate limit exceeded. Please retry after a brief delay.',
            statusCode: 429,
            code: 'TOO_MANY_REQUESTS',
          };
          break;
        default:
          customError = {
            message: data?.message || data?.error || `Server error (${status}).`,
            statusCode: status,
            code: 'SERVER_ERROR',
          };
      }
    } else if (error.request) {
      customError = {
        message: 'Unable to reach public-health backend server. Check connection.',
        statusCode: 0,
        isNetworkError: true,
      };
    }

    return Promise.reject(customError);
  }
);
