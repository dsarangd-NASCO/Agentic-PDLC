'use client';

import React from 'react';
import { DeploymentStatus } from '@/lib/types';
import { getStatusColor, getStatusLabel } from '@/lib/utils';
import { Badge } from './ui/Badge';

interface DeploymentStatusBadgeProps {
  status: DeploymentStatus;
  className?: string;
}

export const DeploymentStatusBadge: React.FC<DeploymentStatusBadgeProps> = ({
  status,
  className,
}) => {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <Badge
      variant={
        status === 'complete'
          ? 'success'
          : status === 'failed' || status === 'rolling_back'
            ? 'danger'
            : status === 'rolled_back'
              ? 'warning'
              : 'default'
      }
      className={className}
    >
      {label}
    </Badge>
  );
};
