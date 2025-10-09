// frontend/src/components/common/ParkingAlertCard.tsx

import React from 'react';

interface CompactAlertCardProps {
  title: string;
  count: number;
  subtitle: string;
  bgColor?: string;
  textColor?: string;
}

const CompactAlertCard: React.FC<CompactAlertCardProps> = ({ 
  title, 
  count, 
  subtitle, 
  bgColor = 'bg-red-50', 
  textColor = 'text-red-600' 
}) => (
  // 1. ลด Padding โดยรวม
  <div className={`${bgColor} p-2 rounded-lg flex items-center justify-between`}>
    <div className="flex flex-col flex-grow mr-2">
      {/* ลดขนาด font ชื่อสาขา */}
      <div className="text-sm text-gray-800 font-semibold">{title}</div>
      {/* ลดขนาด font รหัสร้าน และเอา margin-top ออก */}
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
    <div className="flex items-baseline gap-1 flex-shrink-0">
      {/* ลดขนาด font ตัวเลข */}
      <span className={`text-xl font-bold ${textColor}`}>{count}</span>
      <span className="text-xs text-gray-600">ครั้ง</span>
    </div>
  </div>
);

export default CompactAlertCard;