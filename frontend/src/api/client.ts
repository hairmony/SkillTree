import axios, { AxiosError, type AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function resolveBaseURL(): string {
  if (API_BASE_URL) return API_BASE_URL;
  // In dev with Vite proxy, use relative URLs
  // The proxy in vite.config.ts rewrites /api/* to the backend
  return '/api';
}

const apiClient: AxiosInstance = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 300_000, // 5 minutes to accommodate local LLM inference and avoid premature aborts
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    const message = error.response?.data?.detail 
      || error.message 
      || 'An unexpected error occurred';
    
    // Attach a readable message to the error
    const enhancedError = new Error(message) as Error & { status?: number; original?: AxiosError };
    enhancedError.status = error.response?.status;
    enhancedError.original = error;
    
    return Promise.reject(enhancedError);
  }
);

export default apiClient;
