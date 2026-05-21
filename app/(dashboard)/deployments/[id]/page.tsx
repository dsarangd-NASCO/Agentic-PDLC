'use client';

import React, { useState } from 'react';
import { useDeployment, useDeploymentStages, useRollbackDeployment, useDeploymentLogs } from '@/lib/hooks';
import { DeploymentResponse } from '@/lib/types';
import { 
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  extractArtifactVersion,
  isTerminalStatus,
  canRollback,
} from '@/lib/utils';
import { DeploymentStatusBadge } from '@/components/DeploymentStatusBadge';
import { DeploymentTimeline } from '@/components/DeploymentTimeline';
import { LogViewer } from '@/components/LogViewer';
import { ConfirmRollbackModal } from '@/components/ConfirmRollbackModal';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

interface DeploymentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function DeploymentDetailPage({ params }: DeploymentDetailPageProps) {
  const resolvedParams = React.use(params);
  const deploymentId = resolvedParams.id;
  
  const [showRollbackModal, setShowRollbackModal] = useState(false);

  const {
    data: deployment,
    isLoading: deploymentLoading,
    error: deploymentError,
  } = useDeployment(deploymentId);

  const {
    data: stagesData,
    isLoading: stagesLoading,
  } = useDeploymentStages(deploymentId, { enabled: !!deployment });

  const {
    data: logs = '',
    isLoading: logsLoading,
  } = useDeploymentLogs(deploymentId);

  const {
    mutate: rollback,
    isPending: isRollingBack,
    error: rollbackError,
  } = useRollbackDeployment(deploymentId);

  const handleRollback = (reason?: string) => {
    rollback(reason ? { reason } : undefined, {
      onSuccess: () => {
        setShowRollbackModal(false);
      },
    });
  };

  if (deploymentLoading) {
    return <div className="text-center text-gray-600">Loading deployment...</div>;
  }

  if (deploymentError || !deployment) {
    return (
      <Alert variant="danger" title="Error Loading Deployment">
        {deploymentError instanceof Error ? deploymentError.message : 'Deployment not found'}
      </Alert>
    );
  }

  const isTerminal = isTerminalStatus(deployment.status);
  const canRollbackDeployment = canRollback(deployment.status, deployment.previous_deployment_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">
            Deployment {deployment.deployment_id.slice(0, 8)}
          </h2>
          <p className="text-gray-600">{deployment.service_id}</p>
        </div>
        {canRollbackDeployment && (
          <Button
            variant="destructive"
            onClick={() => setShowRollbackModal(true)}
            disabled={isRollingBack}
          >
            🔄 Rollback
          </Button>
        )}
      </div>

      {/* Status and Metadata Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">DEPLOYMENT STATUS</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <DeploymentStatusBadge status={deployment.status} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Progress</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all"
                    style={{ width: `${deployment.progress}%` }}
                    role="progressbar"
                    aria-valuenow={deployment.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <span className="text-sm font-medium">{deployment.progress}%</span>
              </div>
            </div>
            {deployment.current_stage && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Current Stage</p>
                <p className="text-sm font-medium capitalize">{deployment.current_stage}</p>
              </div>
            )}
            {deployment.error_message && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Error</p>
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {deployment.error_message}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">DEPLOYMENT INFO</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Service</p>
              <p className="font-medium">{deployment.service_id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Environment</p>
              <p className="font-medium capitalize">{deployment.target_env}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Artifact</p>
              <p className="font-mono text-xs bg-gray-100 p-1 rounded">
                {extractArtifactVersion(deployment.artifact_url)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-xs">{formatDateTime(deployment.created_at)}</p>
            </div>
            {deployment.completed_at && (
              <div>
                <p className="text-xs text-gray-500">Completed</p>
                <p className="text-xs">{formatDateTime(deployment.completed_at)}</p>
              </div>
            )}
            {isTerminal && (
              <div>
                <p className="text-xs text-gray-500">Duration</p>
                <p className="font-medium">
                  {formatDuration(deployment.created_at, deployment.completed_at || undefined)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rollback Error Alert */}
      {rollbackError && (
        <Alert variant="danger" title="Rollback Error">
          {rollbackError instanceof Error ? rollbackError.message : 'Failed to rollback deployment'}
        </Alert>
      )}

      {/* Timeline */}
      {stagesData && !stagesLoading && (
        <div className="bg-white rounded-lg shadow p-6">
          <DeploymentTimeline
            stages={stagesData.stages}
            currentStage={deployment.current_stage}
          />
        </div>
      )}

      {/* Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <LogViewer logs={logs} isLoading={logsLoading} />
      </div>

      {/* Rollback Modal */}
      <ConfirmRollbackModal
        isOpen={showRollbackModal}
        deployment_id={deployment.deployment_id}
        service_id={deployment.service_id}
        onConfirm={handleRollback}
        onCancel={() => setShowRollbackModal(false)}
        isLoading={isRollingBack}
      />
    </div>
  );
}
