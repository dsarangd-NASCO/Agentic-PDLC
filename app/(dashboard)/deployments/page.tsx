'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useDeployments } from '@/lib/hooks';
import { DeploymentResponse, DeploymentStatus, TargetEnv } from '@/lib/types';
import { formatRelativeTime, formatDuration, getStatusLabel } from '@/lib/utils';
import { DeploymentStatusBadge } from '@/components/DeploymentStatusBadge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export default function DeploymentsPage() {
  const { data: deployments = [], isLoading, error } = useDeployments();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<DeploymentStatus | ''>('');
  const [filterEnv, setFilterEnv] = useState<TargetEnv | ''>('');

  // Filter deployments based on search and filters
  const filteredDeployments = useMemo(() => {
    return deployments.filter((deployment) => {
      const matchesSearch =
        deployment.service_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deployment.deployment_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !filterStatus || deployment.status === filterStatus;
      const matchesEnv = !filterEnv || deployment.target_env === filterEnv;
      return matchesSearch && matchesStatus && matchesEnv;
    });
  }, [deployments, searchTerm, filterStatus, filterEnv]);

  if (error) {
    return (
      <Alert variant="danger" title="Error Loading Deployments">
        {error instanceof Error ? error.message : 'An error occurred'}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Deployments</h2>
          <p className="text-gray-600">View all deployment history</p>
        </div>
        <Link href="/deployments/new">
          <Button>+ New Deployment</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            id="search"
            placeholder="Search by service ID or deployment ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select
            id="filter-status"
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'queued', label: 'Queued' },
              { value: 'preparing', label: 'Preparing' },
              { value: 'validating', label: 'Validating' },
              { value: 'deploying', label: 'Deploying' },
              { value: 'verifying', label: 'Verifying' },
              { value: 'complete', label: 'Complete' },
              { value: 'failed', label: 'Failed' },
              { value: 'rolled_back', label: 'Rolled Back' },
            ]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as DeploymentStatus | '')}
          />
          <Select
            id="filter-env"
            options={[
              { value: '', label: 'All Environments' },
              { value: 'dev', label: 'Development' },
              { value: 'stage', label: 'Staging' },
              { value: 'prod', label: 'Production' },
            ]}
            value={filterEnv}
            onChange={(e) => setFilterEnv(e.target.value as TargetEnv | '')}
          />
        </div>
      </div>

      {/* Deployments Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading deployments...</div>
        ) : filteredDeployments.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {deployments.length === 0
              ? 'No deployments yet. Create your first deployment to get started.'
              : 'No deployments match the selected filters.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Service</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Environment</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Duration</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Created</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeployments.map((deployment) => (
                <tr
                  key={deployment.deployment_id}
                  className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900">
                      {deployment.service_id}
                    </span>
                    <br />
                    <span className="text-xs text-gray-500">{deployment.deployment_id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <DeploymentStatusBadge status={deployment.status} />
                  </td>
                  <td className="px-6 py-4 capitalize text-gray-600">
                    {deployment.target_env}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {formatDuration(
                      deployment.created_at,
                      deployment.completed_at || undefined
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {formatRelativeTime(deployment.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/deployments/${deployment.deployment_id}`}>
                      <Button variant="ghost" size="sm">
                        View →
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
