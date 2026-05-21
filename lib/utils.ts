import { formatDistanceToNow, formatISO, parseISO } from 'date-fns';
import { DeploymentStatus } from './types';

/**
 * Format ISO datetime string to readable format
 */
export const formatDateTime = (isoString: string): string => {
  try {
    const date = parseISO(isoString);
    return date.toLocaleString();
  } catch {
    return isoString;
  }
};

/**
 * Format ISO datetime string to relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (isoString: string): string => {
  try {
    const date = parseISO(isoString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return isoString;
  }
};

/**
 * Calculate duration in minutes and seconds
 */
export const formatDuration = (startIso: string, endIso?: string): string => {
  try {
    const start = parseISO(startIso);
    const end = endIso ? parseISO(endIso) : new Date();
    const diffMs = end.getTime() - start.getTime();

    if (diffMs < 0) return '0s';

    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  } catch {
    return 'N/A';
  }
};

/**
 * Get status badge color classes
 */
export const getStatusColor = (
  status: DeploymentStatus
): {
  bg: string;
  text: string;
  border: string;
} => {
  switch (status) {
    case 'queued':
      return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
    case 'preparing':
    case 'validating':
    case 'deploying':
    case 'verifying':
      return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' };
    case 'complete':
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
    case 'failed':
      return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
    case 'rolling_back':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
    case 'rolled_back':
      return { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' };
  }
};

/**
 * Get human-readable status label
 */
export const getStatusLabel = (status: DeploymentStatus): string => {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'preparing':
      return 'Preparing';
    case 'validating':
      return 'Validating';
    case 'deploying':
      return 'Deploying';
    case 'verifying':
      return 'Verifying';
    case 'complete':
      return 'Complete';
    case 'failed':
      return 'Failed';
    case 'rolling_back':
      return 'Rolling Back';
    case 'rolled_back':
      return 'Rolled Back';
    default:
      return 'Unknown';
  }
};

/**
 * Determine if deployment is in terminal state
 */
export const isTerminalStatus = (status: DeploymentStatus): boolean => {
  return ['complete', 'failed', 'rolled_back'].includes(status);
};

/**
 * Determine if deployment can be rolled back
 */
export const canRollback = (status: DeploymentStatus, previousDeploymentId?: string): boolean => {
  return (
    !!previousDeploymentId && (status === 'failed' || status === 'complete')
  );
};

/**
 * Format service ID for display
 */
export const formatServiceId = (serviceId: string): string => {
  return serviceId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

/**
 * Extract version/tag from artifact URL
 */
export const extractArtifactVersion = (artifactUrl: string): string => {
  try {
    // Try to extract version from different artifact formats
    if (artifactUrl.includes(':')) {
      const parts = artifactUrl.split(':');
      return parts[parts.length - 1];
    }
    // Try to extract from path
    const pathParts = artifactUrl.split('/');
    return pathParts[pathParts.length - 1];
  } catch {
    return artifactUrl;
  }
};

/**
 * Get stage icon based on status
 */
export const getStageIcon = (status: 'queued' | 'running' | 'complete' | 'failed'): string => {
  switch (status) {
    case 'queued':
      return '⏳';
    case 'running':
      return '⚙️';
    case 'complete':
      return '✓';
    case 'failed':
      return '✗';
    default:
      return '•';
  }
};
