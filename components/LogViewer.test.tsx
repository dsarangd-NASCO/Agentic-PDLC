import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@testing-library/react';
import { LogViewer } from '@/components/LogViewer';

describe('LogViewer Component', () => {
  it('should render logs', () => {
    const logs = 'Starting deployment\nDeployment successful';
    render(<LogViewer logs={logs} />);
    expect(screen.getByText(/Starting deployment/)).toBeInTheDocument();
    expect(screen.getByText(/Deployment successful/)).toBeInTheDocument();
  });

  it('should show loading message when no logs and loading', () => {
    render(<LogViewer logs="" isLoading={true} />);
    expect(screen.getByText('Loading logs...')).toBeInTheDocument();
  });

  it('should show empty state when no logs', () => {
    render(<LogViewer logs="" isLoading={false} />);
    expect(screen.getByText('No logs available')).toBeInTheDocument();
  });

  it('should have copy button', () => {
    render(<LogViewer logs="test logs" />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('should copy logs to clipboard', async () => {
    const logs = 'test logs content';
    const clipboardMock = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardMock,
      },
    });

    render(<LogViewer logs={logs} />);
    const copyButton = screen.getByRole('button', { name: /copy/i });
    await userEvent.click(copyButton);

    expect(clipboardMock).toHaveBeenCalledWith(logs);
  });

  it('should have log role for accessibility', () => {
    render(<LogViewer logs="test" />);
    expect(screen.getByRole('log')).toBeInTheDocument();
  });
});
