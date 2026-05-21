'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DeploymentRequest } from '@/lib/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Alert } from './ui/Alert';

const deploymentFormSchema = z.object({
  service_id: z
    .string()
    .min(1, 'Service ID is required')
    .regex(/^[a-z][a-z0-9\-]{0,19}$/, 'Invalid service ID format'),
  target_env: z.enum(['dev', 'stage', 'prod']),
  artifact_url: z.string().url('Must be a valid URL').min(10),
  health_check_url: z.string().url('Must be a valid URL').min(10),
  health_check_timeout_seconds: z.number().min(10).max(120).default(30),
  approval_required: z.boolean().default(false),
});

type DeploymentFormData = z.infer<typeof deploymentFormSchema>;

interface DeploymentFormProps {
  onSubmit: (data: DeploymentRequest) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}

export const DeploymentForm: React.FC<DeploymentFormProps> = ({
  onSubmit,
  isLoading = false,
  error,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DeploymentFormData>({
    resolver: zodResolver(deploymentFormSchema),
  });

  const onSubmitHandler = async (data: DeploymentFormData) => {
    try {
      await onSubmit(data);
    } catch (err) {
      // Error is handled by parent component
      console.error('Deployment submission failed:', err);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-6">
      {error && (
        <Alert variant="danger">
          {error}
        </Alert>
      )}

      <Input
        {...register('service_id')}
        id="service_id"
        label="Service ID"
        placeholder="my-service"
        error={errors.service_id?.message}
        required
      />

      <Select
        {...register('target_env')}
        id="target_env"
        label="Target Environment"
        options={[
          { value: 'dev', label: 'Development' },
          { value: 'stage', label: 'Staging' },
          { value: 'prod', label: 'Production' },
        ]}
        error={errors.target_env?.message}
        required
      />

      <Input
        {...register('artifact_url')}
        id="artifact_url"
        label="Artifact URL"
        placeholder="ecr://123456789012.dkr.ecr.us-east-1.amazonaws.com/my-service:v1.0.0-abc123"
        error={errors.artifact_url?.message}
        hint="Container image or WAR file URL"
        required
      />

      <Input
        {...register('health_check_url')}
        id="health_check_url"
        label="Health Check URL"
        placeholder="https://my-service.example.com/health"
        error={errors.health_check_url?.message}
        hint="POST-deployment health check endpoint (must return HTTP 200)"
        required
      />

      <Input
        {...register('health_check_timeout_seconds', { valueAsNumber: true })}
        id="health_check_timeout_seconds"
        label="Health Check Timeout (seconds)"
        type="number"
        min={10}
        max={120}
        defaultValue={30}
        error={errors.health_check_timeout_seconds?.message}
      />

      <div className="flex items-center gap-3">
        <input
          {...register('approval_required')}
          id="approval_required"
          type="checkbox"
          className="w-4 h-4 text-blue-600 border-gray-300 rounded"
        />
        <label htmlFor="approval_required" className="text-sm text-gray-700">
          Approval Required (deprecated - controlled upstream)
        </label>
      </div>

      <Button
        type="submit"
        isLoading={isLoading}
        className="w-full"
      >
        Submit Deployment
      </Button>
    </form>
  );
};
