// frontend/src/components/widgets/ChilledBasketAlertWidget.tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import SectionCard from '../common/SectionCard';
import StatCard from '../common/StatCard';
import { DashboardData } from '../../api/analytics';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface ChilledBasketAlertWidgetProps {
  data: DashboardData['chilledBasketAlert'];
}

const ChilledBasketAlertWidget: React.FC<ChilledBasketAlertWidgetProps> = ({ data }) => {
  const navigate = useNavigate(); // Initialize navigate hook

  const handleViewDetailsClick = () => {
    navigate('/chilled-basket-alerts'); // Navigate to Chilled Basket Alert page
  };

  return (
    <SectionCard title="Chilled Basket Alert" status="critical">
      <div className="flex-grow flex flex-col justify-between">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatCard
            title="ตะกร้าที่แจ้งเตือนตอนนี้"
            value={data.currentAlertBaskets}
            subtitle="ตะกร้า"
            color="text-red-600"
            subtitleColor=""
          />
          <StatCard
            title="เหตุที่เกิดขึ้น"
            value={data.totalAlertEvents}
            subtitle="เหตุการณ์"
            color="text-gray-800"
            subtitleColor=""
          />
          <StatCard
            title="เวลาเฉลี่ยที่ใช้"
            value={`${data.avgUsageTime} นาที`}
            subtitle="เฉลี่ย"
            color="text-blue-600"
            subtitleColor=""
          />
          <StatCard
            title="เวลาเฉลี่ยนอกโซน"
            value={`${data.avgOutOfZoneTime} นาที`}
            subtitle="เฉลี่ย"
            color="text-orange-600"
            subtitleColor=""
          />
        </div>

        {/* Top Alerting Branches List */}
        <div className="text-lg font-semibold text-gray-800 mb-2">สาขาที่มีการแจ้งเตือนสูงสุด</div>
        <ul className="space-y-1 mb-4 text-sm text-gray-700">
          {data.topAlertingBranches.map((branch, index) => (
            <li key={index} className="flex justify-between items-center bg-gray-50 p-1 rounded">
              <span>{branch.name} (รหัส {branch.code})</span>
              <span className="font-medium text-orange-600">{branch.count}</span>
            </li>
          ))}
        </ul>

        {/* Graph */}
        <div className="h-48 mb-4 flex-grow">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.graphData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Bar dataKey="count" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Button */}
        <div className="text-center mt-auto">
          <button
            onClick={handleViewDetailsClick} // Add onClick handler
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            ดูรายละเอียด
          </button>
        </div>
      </div>
    </SectionCard>
  );
};

export default ChilledBasketAlertWidget;