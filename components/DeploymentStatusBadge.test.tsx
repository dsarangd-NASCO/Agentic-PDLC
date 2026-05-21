import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeploymentStatusBadge } from '@/components/DeploymentStatusBadge';

describe('DeploymentStatusBadge', () => {
  it('should render complete status with success variant', () => {
    render(<DeploymentStatusBadge status="complete" />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toHaveClass('bg-green-100');
  });

  it('should render failed status with danger variant', () => {
    render(<DeploymentStatusBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toHaveClass('bg-red-100');
  });

  it('should render queued status with default variant', () => {
    render(<DeploymentStatusBadge status="queued" />);
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toHaveClass('bg-blue-100');
  });

  it('should support custom className', () => {
    render(
      <DeploymentStatusBadge status="complete" className="custom-class" />
    );
    expect(screen.getByText('Complete')).toHaveClass('custom-class');
  });
});
