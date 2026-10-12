import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-700 focus-visible:ring-indigo-500 disabled:hover:bg-indigo-600',
  secondary: 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:ring-indigo-500',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/30 hover:bg-red-700 focus-visible:ring-red-500',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-indigo-500',
};

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-xs',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-sm',
};

export default function Button({ variant = 'primary', size = 'md', loading = false, icon: Icon, className = '', children, disabled, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} /> : null}
      {children}
    </button>
  );
}
