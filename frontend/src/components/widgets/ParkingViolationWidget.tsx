// frontend/src/components/widgets/ParkingViolationWidget.tsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import SectionCard from '../common/SectionCard';
import StatCard from '../common/StatCard';
import { DashboardData } from '../../api/analytics';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface ParkingViolationWidgetProps {
  data: DashboardData['parkingViolation'];
}

const ParkingViolationWidget: React.FC<ParkingViolationWidgetProps> = ({ data }) => {
  const navigate = useNavigate(); // Initialize navigate hook

  const handleViewDetailsClick = () => {
    navigate('/parking-violations'); // Navigate to Parking Violation page
  };

  return (
    <SectionCard title="Parking Violation" status="warning">
      <div className="flex-grow flex flex-col justify-between">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatCard
            title="จอดรถเกินเวลาตอนนี้"
            value={data.currentOverdueCars}
            subtitle="คัน"
            color="text-red-600"
            subtitleColor=""
          />
          <StatCard
            title="เหตุการณ์ที่เกิดขึ้น"
            value={data.totalEvents}
            subtitle="เหตุการณ์"
            color="text-gray-800"
            subtitleColor=""
          />
          <StatCard
            title="เวลาจอดรถเฉลี่ย"
            value={`${data.avgParkingTime} นาที`}
            subtitle="เฉลี่ย"
            color="text-blue-600"
            subtitleColor=""
          />
          <StatCard
            title="เวลาเฉลี่ยละเมิด"
            value={`${data.avgViolationDuration} นาที`}
            subtitle="เฉลี่ย"
            color="text-orange-600"
            subtitleColor=""
          />
        </div>

        {/* Top Violating Branches List */}
        <div className="text-lg font-semibold text-gray-800 mb-2">สาขาที่มีการละเมิดสูงสุด</div>
        <ul className="space-y-1 mb-4 text-sm text-gray-700">
          {data.topViolatingBranches.map((branch, index) => (
            <li key={index} className="flex justify-between items-center bg-gray-50 p-1 rounded">
              <span>{branch.name} (รหัส {branch.code})</span>
              <span className="font-medium text-red-600">{branch.count}</span>
            </li>
          ))}
        </ul>

        {/* Graph */}
        <div className="h-48 mb-4 flex-grow">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.graphData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
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

export default ParkingViolationWidget;