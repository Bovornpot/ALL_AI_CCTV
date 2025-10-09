// frontend/src/components/widgets/TopBranchesByAlertsWidget.tsx
import React from 'react';
import AlertCard from '../common/AlertCard';
import SectionCard from '../common/SectionCard';
import { DashboardData } from '../../api/analytics';

interface TopBranchesByAlertsWidgetProps {
  data: DashboardData['topAlertBranches'];
}

const TopBranchesByAlertsWidget: React.FC<TopBranchesByAlertsWidgetProps> = ({ data }) => {
  return (
    <SectionCard title="สาขาที่มี Alerts สูงสุด" status="warning">
      <div className="flex-grow flex flex-col justify-between">
        <div className="space-y-3">
          {data.map((alert, index) => (
            <AlertCard
              key={index}
              title={alert.name}
              count={alert.count}
              subtitle={`รหัสร้าน ${alert.code}`}
              bgColor="bg-orange-50"
              textColor="text-orange-600"
            />
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <button className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-orange-700">
            ดูเหตุการณ์ทั้งหมด
          </button>
        </div>
      </div>
    </SectionCard>
  );
};

export default TopBranchesByAlertsWidget;