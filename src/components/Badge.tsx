import React from 'react';

interface BadgeProps {
  status: string;
  variant?: 'solid' | 'subtle';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, variant = 'subtle', className = '' }) => {
  const normalized = status.toLowerCase();

  let colorClasses = 'bg-gray-100 text-gray-700 border-gray-200';

  if (['present', 'paid', 'completed', 'active', 'a+', 'a', 'pass'].includes(normalized)) {
    colorClasses =
      variant === 'solid'
        ? 'bg-emerald-600 text-white'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['partial', 'ongoing', 'b+', 'b', 'c'].includes(normalized)) {
    colorClasses =
      variant === 'solid'
        ? 'bg-amber-600 text-white'
        : 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (['leave', 'upcoming', 'd'].includes(normalized)) {
    colorClasses =
      variant === 'solid'
        ? 'bg-blue-600 text-white'
        : 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (['absent', 'unpaid', 'fail', 'f'].includes(normalized)) {
    colorClasses =
      variant === 'solid'
        ? 'bg-rose-600 text-white'
        : 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (['admin'].includes(normalized)) {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (['accountant'].includes(normalized)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (['teacher'].includes(normalized)) {
    colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  } else if (['student'].includes(normalized)) {
    colorClasses = 'bg-cyan-50 text-cyan-700 border-cyan-200';
  } else if (['parent'].includes(normalized)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {status}
    </span>
  );
};

export default Badge;
