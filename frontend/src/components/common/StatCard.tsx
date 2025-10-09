// frontend/src/components/common/StatCard.tsx
import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  subtitleColor: string;
  color?: string; // Tailwind text color class, e.g., 'text-green-600'
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle,subtitleColor, color = 'text-gray-600' }) => (
  // Reduced padding from p-3 to p-2 for a more compact card size
  <div className="bg-white p-2 rounded-lg shadow flex flex-col items-center justify-center text-center">
    {/* Reduced font size for title from text-base to text-sm */}
    <div className="text-sm text-gray-500 mb-1 font-medium px-1">
      {title}
    </div>
    {/* Reduced font size for value from text-3xl to text-2xl */}
    <div className={`text-2xl font-bold ${color} mb-1`}>{value}</div>
    {/* Reduced font size for subtitle from text-base to text-sm */}
    <div className={`text-sm ${subtitleColor || color}`}>{subtitle}</div>
  </div>
);

export default StatCard;