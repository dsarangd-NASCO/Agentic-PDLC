'use client';

import React from 'react';
import clsx from 'clsx';

export interface BadgeProps {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'danger';
  children: React.ReactNode;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  className,
}) => {
  const variants = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
  };

  return (
    <span
      className={clsx(
        'inline-block px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
      role="status"
    >
      {children}
    </span>
  );
};

Badge.displayName = 'Badge';

export { Badge };
