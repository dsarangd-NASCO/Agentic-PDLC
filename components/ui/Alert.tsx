'use client';

import React from 'react';
import clsx from 'clsx';

export interface AlertProps {
  variant?: 'default' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const Alert: React.FC<AlertProps> = ({
  variant = 'default',
  title,
  children,
  className,
}) => {
  const variants = {
    default: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div
      className={clsx(
        'rounded-lg border p-4',
        variants[variant],
        className
      )}
      role="alert"
    >
      {title && <h3 className="font-semibold mb-2">{title}</h3>}
      <div className="text-sm">{children}</div>
    </div>
  );
};

Alert.displayName = 'Alert';

export { Alert };
