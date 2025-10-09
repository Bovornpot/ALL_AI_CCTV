// frontend/src/components/widgets/TableOccupancyWidget.tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import SectionCard from '../common/SectionCard';
import StatCard from '../common/StatCard';
import { DashboardData } from '../../api/analytics';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface TableOccupancyWidgetProps {
  data: DashboardData['tableOccupancy'];
}

const TableOccupancyWidget: React.FC<TableOccupancyWidgetProps> = ({ data }) => {
  const navigate = useNavigate(); // Initialize navigate hook

  const handleViewDetailsClick = () => {
    navigate('/table-occupancy'); // Navigate to Table Occupancy page
  };

  return (
    <SectionCard title="Table Occupancy" status="normal">
      <div className="flex-grow flex flex-col justify-between">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="โต๊ะที่กำลังใช้งาน"
            value={data.occupiedTables}
            subtitle="โต๊ะ"
            color="text-green-600"
            subtitleColor=""
          />
          <StatCard
            title="สาขาที่โต๊ะเต็ม"
            value={data.totalFullBranches}
            subtitle="สาขา"
            color="text-orange-600"
            subtitleColor=""
          />
          <StatCard
            title="เวลาเฉลี่ยใช้โต๊ะ"
            value={`${data.avgTableUsageTime} นาที`}
            subtitle="เฉลี่ย"
            color="text-blue-600"
            subtitleColor=""
          />
          <StatCard
            title="คนที่ใช้โต๊ะเฉลี่ย"
            value={data.avgPeoplePerTable}
            subtitle="คน"
            color="text-purple-600"
            subtitleColor=""
          />
        </div>

        {/* Peak Usage Time */}
        <div className="text-center mb-6">
          <div className="text-lg font-semibold text-blue-600">{data.peakUsageTime}</div>
          <div className="text-sm text-gray-600">ช่วงเวลาที่คนใช้โต๊ะเยอะที่สุด</div>
        </div>

        {/* Graph */}
        <div className="h-48 mb-6 flex-grow">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.graphData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
              <Bar dataKey="count" fill="#22c55e" />
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

export default TableOccupancyWidget;