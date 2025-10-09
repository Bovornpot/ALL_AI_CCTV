// frontend/src/components/common/SectionCard.tsx
import React from 'react';

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  status?: 'normal' | 'warning' | 'critical';
}

const SectionCard: React.FC<SectionCardProps> = ({ title, children, status = 'normal' }) => {
  const statusClasses = {
    normal: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    critical: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col h-full"> {/* Added flex flex-col h-full */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusClasses[status]}`}>
          {status === 'normal' ? 'ปกติ' : status === 'warning' ? 'แจ้งเตือน' : 'วิกฤต'}
        </span>
      </div>
      <div className="flex-grow flex flex-col"> {/* Added flex-grow and flex flex-col */}
        {children}
      </div>
    </div>
  );
};

export default SectionCard;
