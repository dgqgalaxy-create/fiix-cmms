import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

export const Input = ({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={`ui-input ${className}`.trim()} {...props} />
);

export const Select = ({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={`ui-input ${className}`.trim()} {...props}>
    {children}
  </select>
);

export const Textarea = ({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={`ui-input min-h-24 ${className}`.trim()} {...props} />
);

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export const Field = ({ label, htmlFor, hint, children, className = '' }: FieldProps) => (
  <label htmlFor={htmlFor} className={`block space-y-1.5 ${className}`.trim()}>
    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
    {children}
    {hint && <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
  </label>
);
