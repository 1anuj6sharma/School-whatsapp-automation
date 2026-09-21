import React from 'react';

export const StatCard = ({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  subtitle,
}) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3.5 rounded-2xl ${bgClass} ${colorClass} transition-transform group-hover:scale-105 duration-200`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
