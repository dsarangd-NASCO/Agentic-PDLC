import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  DeploymentRequest,
  DeploymentResponse,
  DeploymentStagesResponse,
  RollbackRequest,
  RollbackResponse,
  HealthCheckResponse,
  DeploymentFilters,
  ErrorResponse,
} from './types';

// Create axios instance with defaults
const createAxiosInstance = (): AxiosInstance => {
  const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
  const timeout = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || '30000', 10);

  const instance = axios.create({
    baseURL,
    timeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Add request interceptor to add auth token if needed
  instance.interceptors.request.use((config) => {
    // Add Bearer token if available
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Add response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ErrorResponse>) => {
      if (error.response?.data?.error === 'UNAUTHORIZED') {
        // Handle unauthorized - clear token and redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

const axiosInstance = createAxiosInstance();

export const apiClient = {
  deployments: {
    /**
     * Submit a new deployment request
     */
    submit: async (request: DeploymentRequest): Promise<DeploymentResponse> => {
      const response = await axiosInstance.post<DeploymentResponse>('/deployments', request);
      return response.data;
    },

    /**
     * Get deployment status by ID
     */
    getById: async (deploymentId: string): Promise<DeploymentResponse> => {
      const response = await axiosInstance.get<DeploymentResponse>(`/deployments/${deploymentId}`);
      return response.data;
    },

    /**
     * List all deployments with optional filters
     * Note: Assumes GET /deployments supports query params for filtering and pagination
     */
    list: async (filters?: DeploymentFilters): Promise<DeploymentResponse[]> => {
      const response = await axiosInstance.get<DeploymentResponse[]>('/deployments', {
        params: filters,
      });
      return response.data;
    },

    /**
     * Get detailed deployment stages
     */
    getStages: async (deploymentId: string): Promise<DeploymentStagesResponse> => {
      const response = await axiosInstance.get<DeploymentStagesResponse>(
        `/deployments/${deploymentId}/stages`
      );
      return response.data;
    },

    /**
     * Get deployment logs
     */
    getLogs: async (
      deploymentId: string,
      options?: { stage?: string; follow?: boolean }
    ): Promise<string> => {
      const response = await axiosInstance.get<string>(`/deployments/${deploymentId}/logs`, {
        params: options,
      });
      return response.data;
    },

    /**
     * Trigger manual rollback
     */
    rollback: async (deploymentId: string, request?: RollbackRequest): Promise<RollbackResponse> => {
      const response = await axiosInstance.post<RollbackResponse>(
        `/deployments/${deploymentId}/rollback`,
        request || {}
      );
      return response.data;
    },
  },

  health: {
    /**
     * Get overall health status
     */
    get: async (): Promise<HealthCheckResponse> => {
      const response = await axiosInstance.get<HealthCheckResponse | { data: HealthCheckResponse }>(
        '/health'
      );
      const payload =
        response.data && typeof response.data === 'object' && 'data' in response.data
          ? response.data.data
          : response.data;

      if (!payload || typeof payload !== 'object' || !('status' in payload)) {
        throw new Error(
          'Invalid health response. Set NEXT_PUBLIC_API_BASE_URL to your backend API URL.'
        );
      }

      return payload as HealthCheckResponse;
    },

    /**
     * Get readiness status
     */
    ready: async (): Promise<{ status: string }> => {
      const response = await axiosInstance.get<{ status: string } | { data: { status: string } }>(
        '/health/ready'
      );
      return response.data && typeof response.data === 'object' && 'data' in response.data
        ? response.data.data
        : response.data;
    },
  },
};

export default apiClient;
