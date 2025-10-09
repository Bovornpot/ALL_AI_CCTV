// frontend/src/components/common/AlertCard.tsx
import React from 'react';

interface AlertCardProps {
  title: string;
  count: number;
  subtitle: string;
  bgColor?: string; // Tailwind background color class, e.g., 'bg-orange-100'
  textColor?: string; // Tailwind text color for count, e.g., 'text-orange-600'
}

const AlertCard: React.FC<AlertCardProps> = ({ title, count, subtitle, bgColor = 'bg-orange-100', textColor = 'text-orange-600' }) => (
  <div className={`${bgColor} p-4 rounded-lg flex items-center justify-between`}>
    <div className="flex flex-col flex-grow mr-4">
      {/* Increased font size for title (branch name) and made it bolder */}
      <div className="text-lg text-gray-800 font-semibold mb-1">{title}</div>
      {/* Increased font size for subtitle (branch code) and made color clearer */}
      <div className="text-sm text-gray-600">{subtitle}</div>
    </div>
    <div className="flex items-baseline gap-1">
      {/* Count remains large as per previous request */}
      <span className={`text-3xl font-bold ${textColor}`}>{count}</span>
      <span className="text-sm text-gray-600">เหตุการณ์</span>
    </div>
  </div>
);

export default AlertCard;