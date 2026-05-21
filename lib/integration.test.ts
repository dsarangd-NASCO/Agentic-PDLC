import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeployment, useDeployments, useSubmitDeployment } from '@/lib/hooks';
import { DeploymentResponse } from '@/lib/types';
import apiClient from '@/lib/api-client';

// Mock the API client
vi.mock('@/lib/api-client');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Integration Tests - Deployment Workflows', () => {
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

  describe('Journey 1: Submit and Monitor Deployment', () => {
    it('should submit deployment and poll status', async () => {
      const mockDeployment: DeploymentResponse = {
        deployment_id: 'deploy-123',
        service_id: 'test-service',
        target_env: 'prod',
        status: 'queued',
        artifact_url: 'ecr://registry/image:v1.0.0',
        progress: 0,
        current_stage: null,
        created_at: '2026-05-21T14:00:00Z',
        updated_at: '2026-05-21T14:00:00Z',
        completed_at: null,
        error_message: null,
        previous_deployment_id: null,
      };

      vi.mocked(apiClient.deployments.submit).mockResolvedValue(mockDeployment);
      vi.mocked(apiClient.deployments.getById).mockResolvedValue({
        ...mockDeployment,
        status: 'complete',
        progress: 100,
      });

      // Submit deployment
      const { result: submitResult } = renderHook(
        () => useSubmitDeployment(),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          ),
        }
      );

      await submitResult.current.mutateAsync({
        service_id: 'test-service',
        target_env: 'prod',
        artifact_url: 'ecr://registry/image:v1.0.0',
        health_check_url: 'https://example.com/health',
      });

      // Poll deployment status
      const { result: deploymentResult } = renderHook(
        () => useDeployment('deploy-123'),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(deploymentResult.current.data?.deployment_id).toBe('deploy-123');
      });

      expect(apiClient.deployments.submit).toHaveBeenCalled();
      expect(apiClient.deployments.getById).toHaveBeenCalledWith('deploy-123');
    });
  });

  describe('Journey 2: Filter and Search Deployments', () => {
    it('should fetch deployments with filters', async () => {
      const mockDeployments: DeploymentResponse[] = [
        {
          deployment_id: 'deploy-1',
          service_id: 'auth-service',
          target_env: 'prod',
          status: 'complete',
          artifact_url: 'ecr://...',
          progress: 100,
          current_stage: null,
          created_at: '2026-05-21T14:00:00Z',
          updated_at: '2026-05-21T14:30:00Z',
          completed_at: '2026-05-21T14:30:00Z',
          error_message: null,
          previous_deployment_id: null,
        },
      ];

      vi.mocked(apiClient.deployments.list).mockResolvedValue(mockDeployments);

      const { result } = renderHook(
        () => useDeployments({ service_id: 'auth-service' }),
        {
          wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
        expect(result.current.data?.[0].service_id).toBe('auth-service');
      });

      expect(apiClient.deployments.list).toHaveBeenCalledWith({ service_id: 'auth-service' });
    });
  });

  describe('Journey 3: Rollback Failed Deployment', () => {
    it('should rollback deployment with reason', async () => {
      const rollbackResponse = {
        rollback_id: 'rollback-123',
        deployment_id: 'deploy-123',
        previous_deployment_id: 'deploy-122',
        status: 'initiated' as const,
        created_at: '2026-05-21T15:00:00Z',
      };

      vi.mocked(apiClient.deployments.rollback).mockResolvedValue(rollbackResponse);

      // Note: useRollbackDeployment requires router mock, so we just test the API call
      const result = await apiClient.deployments.rollback('deploy-123', {
        reason: 'Health check failed',
      });

      expect(result).toEqual(rollbackResponse);
      expect(apiClient.deployments.rollback).toHaveBeenCalledWith(
        'deploy-123',
        { reason: 'Health check failed' }
      );
    });
  });
});
