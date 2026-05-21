import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeployment, useSubmitDeployment } from '@/lib/hooks';
import apiClient from '@/lib/api-client';

// Mock the API client
vi.mock('@/lib/api-client');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('React Query Hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  describe('useDeployment', () => {
    it('should fetch deployment status', async () => {
      const mockDeployment = {
        deployment_id: 'test-id',
        service_id: 'test-service',
        target_env: 'dev' as const,
        status: 'queued' as const,
        artifact_url: 'http://test',
        progress: 0,
        current_stage: null,
        created_at: '2026-05-21T00:00:00Z',
        updated_at: '2026-05-21T00:00:00Z',
        completed_at: null,
        error_message: null,
        previous_deployment_id: null,
      };

      vi.mocked(apiClient.deployments.getById).mockResolvedValue(mockDeployment);

      const { result } = renderHook(
        () => useDeployment('test-id'),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockDeployment);
      });
    });

    it('should not fetch when deployment ID is null', () => {
      renderHook(
        () => useDeployment(null),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          ),
        }
      );

      expect(apiClient.deployments.getById).not.toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Network error');
      vi.mocked(apiClient.deployments.getById).mockRejectedValue(error);

      const { result } = renderHook(
        () => useDeployment('test-id'),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result.current.error).toEqual(error);
      });
    });
  });
});
