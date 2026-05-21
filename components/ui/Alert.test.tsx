import { describe, it, expect } from 'vitest';
import { render, screen, userEvent } from '@testing-library/react';
import { Alert } from '@/components/ui/Alert';

describe('Alert Component', () => {
  it('should render alert with title and message', () => {
    render(
      <Alert title="Error">
        Something went wrong
      </Alert>
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should apply variant styles', () => {
    const { rerender } = render(
      <Alert variant="success">Success!</Alert>
    );
    let alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-green-50');

    rerender(<Alert variant="danger">Error!</Alert>);
    alert = screen.getByRole('alert');
    expect(alert).toHaveClass('bg-red-50');
  });

  it('should apply custom className', () => {
    render(
      <Alert className="custom-alert">Message</Alert>
    );
    expect(screen.getByRole('alert')).toHaveClass('custom-alert');
  });
});
