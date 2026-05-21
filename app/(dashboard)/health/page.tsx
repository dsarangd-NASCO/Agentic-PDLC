'use client';

import React from 'react';
import { useHealth } from '@/lib/hooks';
import { Alert } from '@/components/ui/Alert';

export default function HealthPage() {
  const { data: health, isLoading, error, refetch } = useHealth({ refetchInterval: 30000 });
  const overallStatus = health?.status ?? 'unknown';
  const checks = health?.checks;

  const getHealthIcon = (status: string | undefined) => {
    switch (status) {
      case 'healthy':
        return '🟢';
      case 'degraded':
        return '🟡';
      case 'unhealthy':
        return '🔴';
      default:
        return '⚪';
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold mb-2">System Health</h2>
        <p className="text-gray-600">
          Monitor deploy-hub service health and component status
        </p>
      </div>

      {error ? (
        <Alert variant="danger" title="Error Loading Health">
          {error instanceof Error ? error.message : 'Failed to load health status'}
        </Alert>
      ) : isLoading ? (
        <div className="text-center text-gray-500">Loading health status...</div>
      ) : health ? (
        <>
          {/* Overall Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl">{getHealthIcon(overallStatus)}</span>
              <div>
                <h3 className="text-lg font-semibold mb-1">Overall Status</h3>
                <p className="text-gray-600">
                  {overallStatus === 'healthy'
                    ? 'Deploy-hub is operating normally'
                    : overallStatus === 'degraded'
                      ? 'Deploy-hub is operational with some degradation'
                      : 'Deploy-hub is experiencing issues'}
                </p>
              </div>
            </div>

            <div
              className={`px-4 py-2 rounded-lg font-semibold text-white w-fit ${
                overallStatus === 'healthy'
                  ? 'bg-green-600'
                  : overallStatus === 'degraded'
                    ? 'bg-yellow-600'
                    : 'bg-red-600'
              }`}
              role="status"
            >
              {overallStatus.toUpperCase()}
            </div>
          </div>

          {/* Component Health Cards */}
          {checks && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">
                    {getHealthIcon(checks.database === 'ok' ? 'healthy' : 'unhealthy')}
                  </span>
                  <h4 className="font-semibold">Database</h4>
                </div>
                <p
                  className={`text-sm font-medium ${
                    checks.database === 'ok' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {checks.database === 'ok' ? '✓ Connected' : '✗ Disconnected'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">
                    {getHealthIcon(checks.codebuild === 'ok' ? 'healthy' : 'unhealthy')}
                  </span>
                  <h4 className="font-semibold">CodeBuild</h4>
                </div>
                <p
                  className={`text-sm font-medium ${
                    checks.codebuild === 'ok' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {checks.codebuild === 'ok' ? '✓ Available' : '✗ Unavailable'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">
                    {getHealthIcon(checks.codedeploy === 'ok' ? 'healthy' : 'unhealthy')}
                  </span>
                  <h4 className="font-semibold">CodeDeploy</h4>
                </div>
                <p
                  className={`text-sm font-medium ${
                    checks.codedeploy === 'ok' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {checks.codedeploy === 'ok' ? '✓ Available' : '✗ Unavailable'}
                </p>
              </div>
            </div>
          )}

          {/* System Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">System Information</h3>
            <div className="space-y-3 text-sm">
              {health.uptime_seconds !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Uptime:</span>
                  <span className="font-medium">
                    {Math.floor(health.uptime_seconds / 86400)} days,{' '}
                    {Math.floor((health.uptime_seconds % 86400) / 3600)} hours
                  </span>
                </div>
              )}
              {health.timestamp && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Check:</span>
                  <span className="font-medium">{new Date(health.timestamp).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh Status
          </button>
        </>
      ) : null}
    </div>
  );
}
