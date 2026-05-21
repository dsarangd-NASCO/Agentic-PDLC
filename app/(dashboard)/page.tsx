'use client';

import React from 'react';
import { useHealth } from '@/lib/hooks';
import { Alert } from '@/components/ui/Alert';

export default function DashboardPage() {
  const { data: health, isLoading } = useHealth();
  const overallStatus = health?.status ?? 'unknown';
  const checks = health?.checks;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Welcome to Deploy-Hub</h2>
        <p className="text-gray-600">
          Deployment orchestration platform for standardized, reliable service deployments.
        </p>
      </div>

      {/* System Status Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">System Status</h3>
        {isLoading ? (
          <div className="text-gray-500">Loading status...</div>
        ) : health ? (
          <div className="space-y-3">
            <Alert
              variant={
                overallStatus === 'healthy'
                  ? 'success'
                  : overallStatus === 'degraded'
                    ? 'warning'
                    : 'danger'
              }
            >
              Overall Status: <strong>{overallStatus.toUpperCase()}</strong>
            </Alert>
            {checks && (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Database:</span>{' '}
                  <span className={checks.database === 'ok' ? 'text-green-600' : 'text-red-600'}>
                    {checks.database === 'ok' ? '✓' : '✗'} {checks.database ?? 'unknown'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">CodeBuild:</span>{' '}
                  <span className={checks.codebuild === 'ok' ? 'text-green-600' : 'text-red-600'}>
                    {checks.codebuild === 'ok' ? '✓' : '✗'} {checks.codebuild ?? 'unknown'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">CodeDeploy:</span>{' '}
                  <span className={checks.codedeploy === 'ok' ? 'text-green-600' : 'text-red-600'}>
                    {checks.codedeploy === 'ok' ? '✓' : '✗'} {checks.codedeploy ?? 'unknown'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Alert variant="danger">Failed to load system status</Alert>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold mb-2">📋 View Deployments</h3>
          <p className="text-gray-600 mb-4">
            Check the status and history of all deployments.
          </p>
          <a href="/deployments" className="text-blue-600 hover:text-blue-800 font-medium">
            Go to Deployments →
          </a>
        </div>

        <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
          <h3 className="text-lg font-semibold mb-2">🚀 Submit New Deployment</h3>
          <p className="text-gray-600 mb-4">
            Deploy a new service version to dev, stage, or production.
          </p>
          <a href="/deployments/new" className="text-blue-600 hover:text-blue-800 font-medium">
            Submit Deployment →
          </a>
        </div>
      </div>
    </div>
  );
}
