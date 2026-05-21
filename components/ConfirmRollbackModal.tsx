'use client';

import React from 'react';
import { Button } from './ui/Button';

interface ConfirmRollbackModalProps {
  isOpen: boolean;
  deployment_id: string;
  service_id: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmRollbackModal: React.FC<ConfirmRollbackModalProps> = ({
  isOpen,
  deployment_id,
  service_id,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [reason, setReason] = React.useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
  };

  const handleCancel = () => {
    onCancel();
    setReason('');
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rollback-title"
    >
      <div
        className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="rollback-title" className="text-xl font-bold mb-4">
          Confirm Rollback
        </h2>
        <p className="text-gray-600 mb-4">
          Are you sure you want to rollback the deployment for <strong>{service_id}</strong>?
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Deployment ID: <code className="bg-gray-100 px-2 py-1 rounded">{deployment_id}</code>
        </p>

        <div className="mb-4">
          <label htmlFor="reason" className="block text-sm font-medium text-gray-900 mb-2">
            Reason (optional)
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you rolling back?"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            rows={3}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            Rollback
          </Button>
        </div>
      </div>
    </div>
  );
};
