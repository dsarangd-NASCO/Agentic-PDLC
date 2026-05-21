import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import apiClient from './api-client';
import {
  DeploymentRequest,
  DeploymentResponse,
  DeploymentStagesResponse,
  RollbackRequest,
  RollbackResponse,
  HealthCheckResponse,
  DeploymentFilters,
} from './types';

// Query keys for React Query cache management
export const deploymentQueryKeys = {
  all: ['deployments'] as const,
  lists: () => [...deploymentQueryKeys.all, 'list'] as const,
  list: (filters?: DeploymentFilters) => [...deploymentQueryKeys.lists(), { filters }] as const,
  details: () => [...deploymentQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...deploymentQueryKeys.details(), id] as const,
  stages: (id: string) => [...deploymentQueryKeys.detail(id), 'stages'] as const,
  logs: (id: string) => [...deploymentQueryKeys.detail(id), 'logs'] as const,
};

export const healthQueryKeys = {
  all: ['health'] as const,
  check: () => [...healthQueryKeys.all, 'check'] as const,
  ready: () => [...healthQueryKeys.all, 'ready'] as const,
};

/**
 * Hook to fetch and poll deployment status
 * Automatically refetches every 5 seconds while deployment is in progress
 */
export const useDeployment = (
  deploymentId: string | null,
  options?: { refetchInterval?: number; enabled?: boolean }
): UseQueryResult<DeploymentResponse, Error> => {
  const refetchInterval = options?.refetchInterval ?? 5000;
  const enabled = options?.enabled ?? !!deploymentId;

  return useQuery<DeploymentResponse, Error>({
    queryKey: deploymentQueryKeys.detail(deploymentId || ''),
    queryFn: () => apiClient.deployments.getById(deploymentId!),
    refetchInterval,
    enabled,
    staleTime: 0, // Always refetch, no stale time
  });
};

/**
 * Hook to fetch deployment stages with detailed timeline
 */
export const useDeploymentStages = (
  deploymentId: string | null,
  options?: { enabled?: boolean }
): UseQueryResult<DeploymentStagesResponse, Error> => {
  return useQuery<DeploymentStagesResponse, Error>({
    queryKey: deploymentQueryKeys.stages(deploymentId || ''),
    queryFn: () => apiClient.deployments.getStages(deploymentId!),
    enabled: options?.enabled ?? !!deploymentId,
  });
};

/**
 * Hook to fetch deployment logs
 */
export const useDeploymentLogs = (
  deploymentId: string | null,
  stage?: string
): UseQueryResult<string, Error> => {
  return useQuery<string, Error>({
    queryKey: deploymentQueryKeys.logs(deploymentId || ''),
    queryFn: () => apiClient.deployments.getLogs(deploymentId!, { stage }),
    enabled: !!deploymentId,
    staleTime: 5000,
  });
};

/**
 * Hook to list deployments with optional filtering and pagination
 */
export const useDeployments = (
  filters?: DeploymentFilters
): UseQueryResult<DeploymentResponse[], Error> => {
  return useQuery<DeploymentResponse[], Error>({
    queryKey: deploymentQueryKeys.list(filters),
    queryFn: () => apiClient.deployments.list(filters),
    staleTime: 10000,
  });
};

/**
 * Hook to submit a new deployment
 */
export const useSubmitDeployment = (): UseMutationResult<
  DeploymentResponse,
  Error,
  DeploymentRequest
> => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (request: DeploymentRequest) => apiClient.deployments.submit(request),
    onSuccess: (data) => {
      // Invalidate deployment lists
      queryClient.invalidateQueries({ queryKey: deploymentQueryKeys.lists() });
      // Navigate to deployment detail page
      router.push(`/deployments/${data.deployment_id}`);
    },
  });
};

/**
 * Hook to trigger deployment rollback
 */
export const useRollbackDeployment = (
  deploymentId: string
): UseMutationResult<RollbackResponse, Error, RollbackRequest | undefined> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request?: RollbackRequest) =>
      apiClient.deployments.rollback(deploymentId, request),
    onSuccess: () => {
      // Invalidate deployment detail cache to refresh status
      queryClient.invalidateQueries({ queryKey: deploymentQueryKeys.detail(deploymentId) });
      // Invalidate deployments list cache
      queryClient.invalidateQueries({ queryKey: deploymentQueryKeys.lists() });
    },
  });
};

/**
 * Hook to fetch system health status
 */
export const useHealth = (
  options?: { refetchInterval?: number }
): UseQueryResult<HealthCheckResponse, Error> => {
  return useQuery<HealthCheckResponse, Error>({
    queryKey: healthQueryKeys.check(),
    queryFn: () => apiClient.health.get(),
    refetchInterval: options?.refetchInterval ?? 30000,
  });
};

/**
 * Hook to check if system is ready
 */
export const useHealthReady = (): UseQueryResult<{ status: string }, Error> => {
  return useQuery<{ status: string }, Error>({
    queryKey: healthQueryKeys.ready(),
    queryFn: () => apiClient.health.ready(),
    staleTime: 30000,
  });
};
