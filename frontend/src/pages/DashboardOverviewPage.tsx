// frontend/src/pages/DashboardOverviewPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { DashboardData, fetchDashboardData } from '../api/analytics';
import OverallSystemPerformanceWidget from '../components/widgets/OverallSystemPerformanceWidget';
import TopBranchesByAlertsWidget from '../components/widgets/TopBranchesByAlertsWidget';
import ParkingViolationWidget from '../components/widgets/ParkingViolationWidget';
import TableOccupancyWidget from '../components/widgets/TableOccupancyWidget';
import ChilledBasketAlertWidget from '../components/widgets/ChilledBasketAlertWidget';
import { TimeSelection } from '../types/time';

interface DashboardOverviewPageProps {
  timeSelection: TimeSelection;
  branchQuery: string;
}

const DashboardOverviewPage: React.FC<DashboardOverviewPageProps> = ({ timeSelection, branchQuery  }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Fetching data with new filters:');
      console.log('Time Selection:', timeSelection);
      console.log('Branch Query:', branchQuery);
      // console.log('Dashboard is fetching data with:', timeSelection);

      // แปลงค่าจาก timeSelection เป็นรูปแบบที่ API เดิมต้องการ
      const dateToFetch = timeSelection.activeTab === 'Day' ? timeSelection.endDate : new Date();
      const tabToFetch = timeSelection.activeTab.toLowerCase() as 'day' | 'week' | 'month';
      
      const data = await fetchDashboardData(dateToFetch, tabToFetch);
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  }, [timeSelection, branchQuery]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="ml-4 text-gray-600">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-full py-20 text-red-600">
        <p>ไม่สามารถโหลดข้อมูล Dashboard ได้ โปรดลองอีกครั้ง</p>
      </div>
    );
  }

  return (
    <div className="dashboard-overview-page space-y-2">
      {/* Top Row Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <OverallSystemPerformanceWidget data={dashboardData.overallSystem} />
        </div>
        <div className="flex flex-col">
          <TopBranchesByAlertsWidget data={dashboardData.topAlertBranches} />
        </div>
      </div>

      {/* Bottom Row Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <ParkingViolationWidget data={dashboardData.parkingViolation} />
        <TableOccupancyWidget data={dashboardData.tableOccupancy} />
        <ChilledBasketAlertWidget data={dashboardData.chilledBasketAlert} />
      </div>
    </div>
  );
};

export default DashboardOverviewPage;