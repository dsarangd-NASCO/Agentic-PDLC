'use client';

import React from 'react';
import clsx from 'clsx';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={props.id} className="text-sm font-medium text-gray-900">
            {label}
            {props.required && <span className="text-red-600 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={clsx(
            'px-3 py-2 border rounded-md text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            'disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed',
            error
              ? 'border-red-600 focus-visible:ring-red-500'
              : 'border-gray-300 focus-visible:ring-blue-500',
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
