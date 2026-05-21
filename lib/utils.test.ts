import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatDateTime,
  formatRelativeTime,
  formatDuration,
  getStatusColor,
  getStatusLabel,
  isTerminalStatus,
  canRollback,
  extractArtifactVersion,
} from '@/lib/utils';

describe('Utils', () => {
  describe('formatDateTime', () => {
    it('should format ISO datetime string', () => {
      const result = formatDateTime('2026-05-21T14:30:00Z');
      expect(result).toContain('2026');
      expect(result).not.toBe('2026-05-21T14:30:00Z');
    });

    it('should handle invalid dates gracefully', () => {
      const result = formatDateTime('invalid-date');
      expect(result).toBe('invalid-date');
    });
  });

  describe('getStatusColor', () => {
    it('should return green colors for complete status', () => {
      const color = getStatusColor('complete');
      expect(color.bg).toBe('bg-green-100');
      expect(color.text).toBe('text-green-800');
    });

    it('should return red colors for failed status', () => {
      const color = getStatusColor('failed');
      expect(color.bg).toBe('bg-red-100');
      expect(color.text).toBe('text-red-800');
    });

    it('should return blue colors for in-progress statuses', () => {
      const color = getStatusColor('deploying');
      expect(color.bg).toBe('bg-blue-100');
      expect(color.text).toBe('text-blue-800');
    });
  });

  describe('getStatusLabel', () => {
    it('should return human-readable labels for statuses', () => {
      expect(getStatusLabel('queued')).toBe('Queued');
      expect(getStatusLabel('complete')).toBe('Complete');
      expect(getStatusLabel('failed')).toBe('Failed');
    });
  });

  describe('isTerminalStatus', () => {
    it('should identify terminal statuses', () => {
      expect(isTerminalStatus('complete')).toBe(true);
      expect(isTerminalStatus('failed')).toBe(true);
      expect(isTerminalStatus('rolled_back')).toBe(true);
    });

    it('should identify non-terminal statuses', () => {
      expect(isTerminalStatus('queued')).toBe(false);
      expect(isTerminalStatus('deploying')).toBe(false);
    });
  });

  describe('canRollback', () => {
    it('should allow rollback for failed deployments with previous version', () => {
      expect(canRollback('failed', 'prev-id')).toBe(true);
    });

    it('should not allow rollback without previous version', () => {
      expect(canRollback('failed')).toBe(false);
    });

    it('should not allow rollback for non-eligible statuses', () => {
      expect(canRollback('queued', 'prev-id')).toBe(false);
    });
  });

  describe('extractArtifactVersion', () => {
    it('should extract version from container image URL', () => {
      const url = 'ecr://registry/image:v1.0.0-abc123';
      expect(extractArtifactVersion(url)).toBe('v1.0.0-abc123');
    });

    it('should extract version from S3 WAR file', () => {
      const url = 's3://bucket/path/artifact.war';
      expect(extractArtifactVersion(url)).toBe('artifact.war');
    });
  });
});
