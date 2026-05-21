import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@testing-library/react';
import { ConfirmRollbackModal } from '@/components/ConfirmRollbackModal';

describe('ConfirmRollbackModal', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  it('should not render when isOpen is false', () => {
    render(
      <ConfirmRollbackModal
        isOpen={false}
        deployment_id="test-id"
        service_id="test-service"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.queryByText('Confirm Rollback')).not.toBeInTheDocument();
  });

  it('should render modal when isOpen is true', () => {
    render(
      <ConfirmRollbackModal
        isOpen={true}
        deployment_id="test-id"
        service_id="test-service"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByText('Confirm Rollback')).toBeInTheDocument();
    expect(screen.getByText(/test-service/)).toBeInTheDocument();
  });

  it('should call onCancel when cancel button clicked', async () => {
    render(
      <ConfirmRollbackModal
        isOpen={true}
        deployment_id="test-id"
        service_id="test-service"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onConfirm with reason when rollback button clicked', async () => {
    render(
      <ConfirmRollbackModal
        isOpen={true}
        deployment_id="test-id"
        service_id="test-service"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    const reasonInput = screen.getByPlaceholderText('Why are you rolling back?');
    await userEvent.type(reasonInput, 'Health check failed');
    await userEvent.click(screen.getByRole('button', { name: /rollback/i }));
    expect(mockOnConfirm).toHaveBeenCalledWith('Health check failed');
  });

  it('should have dialog role for accessibility', () => {
    render(
      <ConfirmRollbackModal
        isOpen={true}
        deployment_id="test-id"
        service_id="test-service"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
