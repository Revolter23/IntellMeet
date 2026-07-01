import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
  withCredentials: true,
});

// Request Interceptor: Attach access token if present
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 errors and attempt silent refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if the error is 401 (Unauthorized) and the request hasn't been retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try refreshing the token using a standard axios instance to avoid interceptor recursion
        const refreshResponse = await axios.post(
          'http://localhost:3000/auth/refresh',
          {},
          { withCredentials: true }
        );

        const { accessToken, user } = refreshResponse.data;

        // Update the auth store
        useAuthStore.getState().setAuth(accessToken, user);

        // Update headers in original request and retry
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Silent refresh failed (session expired or invalid refresh token)
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
