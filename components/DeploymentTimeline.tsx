'use client';

import React, { useMemo } from 'react';
import { DeploymentStage } from '@/lib/types';
import { formatDuration, getStageIcon } from '@/lib/utils';

interface DeploymentTimelineProps {
  stages: DeploymentStage[];
  currentStage?: string | null;
}

export const DeploymentTimeline: React.FC<DeploymentTimelineProps> = ({
  stages,
  currentStage,
}) => {
  const stageOrder = ['prepare', 'validate', 'deploy', 'verify', 'finalize'];

  // Sort stages by the predefined order
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => stageOrder.indexOf(a.stage_name) - stageOrder.indexOf(b.stage_name)),
    [stages]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Deployment Timeline</h3>
      <div className="space-y-4">
        {sortedStages.map((stage, index) => {
          const isActive = stage.stage_name === currentStage;
          const isComplete = stage.status === 'complete';
          const isFailed = stage.status === 'failed';

          return (
            <div key={stage.stage_name} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                    isFailed
                      ? 'bg-red-600'
                      : isComplete
                        ? 'bg-green-600'
                        : isActive
                          ? 'bg-blue-600'
                          : 'bg-gray-300'
                  }`}
                  role="status"
                  aria-label={`${stage.stage_name} stage: ${stage.status}`}
                >
                  {isFailed
                    ? '✗'
                    : isComplete
                      ? '✓'
                      : isActive
                        ? '⚙️'
                        : index + 1}
                </div>
                {index < sortedStages.length - 1 && (
                  <div
                    className={`w-1 h-8 ${
                      isComplete || isFailed ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium capitalize text-gray-900">
                      {stage.stage_name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {stage.status === 'running' || isActive ? (
                        <span className="text-blue-600">In progress...</span>
                      ) : stage.status === 'complete' ? (
                        <span className="text-green-600">Completed</span>
                      ) : stage.status === 'failed' ? (
                        <span className="text-red-600">Failed</span>
                      ) : (
                        <span className="text-gray-500">Queued</span>
                      )}
                    </p>
                  </div>
                  {stage.duration_ms !== null && (
                    <span className="text-sm text-gray-600">
                      {formatDuration(stage.started_at, stage.completed_at || undefined)}
                    </span>
                  )}
                </div>
                {stage.error_message && (
                  <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                    {stage.error_message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
