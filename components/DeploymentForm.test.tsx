import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent, waitFor } from '@testing-library/react';
import { DeploymentForm } from '@/components/DeploymentForm';

describe('DeploymentForm', () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

  it('should render form fields', () => {
    render(<DeploymentForm onSubmit={mockOnSubmit} />);
    expect(screen.getByLabelText(/service id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target environment/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/artifact url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/health check url/i)).toBeInTheDocument();
  });

  it('should validate required fields', async () => {
    render(<DeploymentForm onSubmit={mockOnSubmit} />);
    const submitButton = screen.getByRole('button', { name: /submit deployment/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/service id is required/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should validate service ID format', async () => {
    render(<DeploymentForm onSubmit={mockOnSubmit} />);
    const serviceIdInput = screen.getByLabelText(/service id/i) as HTMLInputElement;
    await userEvent.type(serviceIdInput, 'INVALID_ID');
    const submitButton = screen.getByRole('button', { name: /submit deployment/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid service id format/i)).toBeInTheDocument();
    });
  });

  it('should validate artifact URL format', async () => {
    render(<DeploymentForm onSubmit={mockOnSubmit} />);
    const serviceIdInput = screen.getByLabelText(/service id/i);
    const artifactUrlInput = screen.getByLabelText(/artifact url/i);

    await userEvent.type(serviceIdInput, 'my-service');
    await userEvent.type(artifactUrlInput, 'not-a-url');

    const submitButton = screen.getByRole('button', { name: /submit deployment/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/must be a valid url/i)).toBeInTheDocument();
    });
  });

  it('should submit valid form data', async () => {
    render(<DeploymentForm onSubmit={mockOnSubmit} />);

    await userEvent.type(screen.getByLabelText(/service id/i), 'my-service');
    await userEvent.selectOptions(screen.getByLabelText(/target environment/i), 'prod');
    await userEvent.type(
      screen.getByLabelText(/artifact url/i),
      'ecr://registry/image:v1.0.0'
    );
    await userEvent.type(
      screen.getByLabelText(/health check url/i),
      'https://my-service.example.com/health'
    );

    const submitButton = screen.getByRole('button', { name: /submit deployment/i });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          service_id: 'my-service',
          target_env: 'prod',
          artifact_url: 'ecr://registry/image:v1.0.0',
          health_check_url: 'https://my-service.example.com/health',
        })
      );
    });
  });

  it('should show loading state while submitting', () => {
    render(<DeploymentForm onSubmit={mockOnSubmit} isLoading={true} />);
    const submitButton = screen.getByRole('button', { name: /submit deployment/i });
    expect(submitButton).toBeDisabled();
  });

  it('should display error message', () => {
    render(
      <DeploymentForm
        onSubmit={mockOnSubmit}
        error="Network error occurred"
      />
    );
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
  });
});
