'use client';

import React, { useEffect, useRef } from 'react';

interface LogViewerProps {
  logs: string;
  isLoading?: boolean;
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs, isLoading = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Deployment Logs</h3>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
          aria-label="Copy logs to clipboard"
        >
          📋 Copy
        </button>
      </div>
      <div
        ref={containerRef}
        className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto"
        role="log"
        aria-live="polite"
      >
        {logs ? (
          logs.split('\n').map((line, index) => (
            <div key={index} className="whitespace-pre-wrap break-words">
              {line}
            </div>
          ))
        ) : (
          <div className="text-gray-500">{isLoading ? 'Loading logs...' : 'No logs available'}</div>
        )}
      </div>
    </div>
  );
};
