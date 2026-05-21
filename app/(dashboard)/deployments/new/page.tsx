'use client';

import React, { useState } from 'react';
import { useSubmitDeployment } from '@/lib/hooks';
import { DeploymentRequest } from '@/lib/types';
import { DeploymentForm } from '@/components/DeploymentForm';
import { Alert } from '@/components/ui/Alert';

export default function NewDeploymentPage() {
  const { mutateAsync: submitDeployment, isPending, error } = useSubmitDeployment();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (data: DeploymentRequest) => {
    setSubmitError(null);
    try {
      await submitDeployment(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit deployment';
      setSubmitError(errorMessage);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold mb-2">Submit New Deployment</h2>
        <p className="text-gray-600">
          Deploy a service artifact to dev, stage, or production environments.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <DeploymentForm
          onSubmit={handleSubmit}
          isLoading={isPending}
          error={submitError}
        />
      </div>

      <Alert variant="default">
        <strong>Note:</strong> Health check URLs must return HTTP 200 with a valid health status.
        Deployments will be monitored and automatically rolled back on health check failures.
      </Alert>
    </div>
  );
}
