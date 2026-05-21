import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeploymentTimeline } from '@/components/DeploymentTimeline';
import { DeploymentStage } from '@/lib/types';

describe('DeploymentTimeline', () => {
  const mockStages: DeploymentStage[] = [
    {
      stage_name: 'prepare',
      status: 'complete',
      started_at: '2026-05-21T14:00:00Z',
      completed_at: '2026-05-21T14:05:00Z',
      duration_ms: 300000,
      error_message: null,
    },
    {
      stage_name: 'validate',
      status: 'running',
      started_at: '2026-05-21T14:05:00Z',
      completed_at: null,
      duration_ms: null,
      error_message: null,
    },
    {
      stage_name: 'deploy',
      status: 'queued',
      started_at: '2026-05-21T14:05:00Z',
      completed_at: null,
      duration_ms: null,
      error_message: null,
    },
  ];

  it('should render all stages', () => {
    render(<DeploymentTimeline stages={mockStages} />);
    expect(screen.getByText('prepare')).toBeInTheDocument();
    expect(screen.getByText('validate')).toBeInTheDocument();
    expect(screen.getByText('deploy')).toBeInTheDocument();
  });

  it('should highlight current stage', () => {
    render(<DeploymentTimeline stages={mockStages} currentStage="validate" />);
    const validateSection = screen.getByText('validate').closest('div');
    expect(validateSection?.textContent).toContain('In progress');
  });

  it('should show completion status for completed stages', () => {
    render(<DeploymentTimeline stages={mockStages} />);
    const prepareSection = screen.getByText('prepare').closest('div');
    expect(prepareSection?.textContent).toContain('Completed');
  });

  it('should display error message if stage failed', () => {
    const failedStages: DeploymentStage[] = [
      {
        ...mockStages[0],
        status: 'failed',
        error_message: 'Validation failed',
      },
    ];
    render(<DeploymentTimeline stages={failedStages} />);
    expect(screen.getByText('Validation failed')).toBeInTheDocument();
  });
});
