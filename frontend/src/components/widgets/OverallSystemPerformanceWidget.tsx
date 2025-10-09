// frontend/src/components/widgets/OverallSystemPerformanceWidget.tsx
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import SectionCard from '../common/SectionCard';
import StatCard from '../common/StatCard';
import { DashboardData } from '../../api/analytics'; // Import DashboardData interface

interface OverallSystemPerformanceWidgetProps {
  data: DashboardData['overallSystem'];
}

const OverallSystemPerformanceWidget: React.FC<OverallSystemPerformanceWidgetProps> = ({ data }) => {
  return (
    <SectionCard title="Overall System & Performance" status="normal">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          title="สาขาที่ Online"
          value={data.onlineBranches.toLocaleString()}
          subtitle="สาขา"
          color="text-green-600"
          subtitleColor=""
        />
        <StatCard
          title="กล้องที่ Online"
          value={data.onlineCameras.toLocaleString()}
          subtitle="กล้อง"
          color="text-blue-600"
          subtitleColor=""
        />
        <StatCard
          title="กล้องที่ Offline"
          value={data.offlineCameras.toLocaleString()}
          subtitle="กล้อง"
          color="text-red-600"
          subtitleColor=""
        />
        <StatCard
          title="คำเตือนล่าสุด"
          value={data.latestAlerts}
          subtitle="คำเตือน"
          color="text-orange-600"
          subtitleColor=""
        />
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-4 mb-2">
          <span className="text-sm text-gray-600">เหตุการณ์ที่ตรวจพบ</span>
          {/* Active tab will be passed from Header, not managed here */}
          <span className="text-sm font-medium capitalize">ตามช่วงเวลา</span>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Parking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Table Occupancy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>Chilled Basket</span>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.overallEventsGraph}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              padding={{ left: 10, right: 10 }}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}`}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <Line type="monotone" dataKey="parking" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="table" stroke="#22c55e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="chilledBasket" stroke="#f97316" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-end mt-4">
        <button className="bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700">
          ดูรายละเอียดกล้อง
        </button>
      </div>
    </SectionCard>
  );
};

export default OverallSystemPerformanceWidget;