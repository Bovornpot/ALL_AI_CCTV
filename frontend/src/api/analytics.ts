// frontend/src/api/analytics.ts

// Interfaces for graph data
export interface OverallEventsGraphData {
  label: string;
  parking: number;
  table: number;
  chilledBasket: number;
}

export interface ChartData {
  label: string;
  count: number;
}

// Interface for Top Branches data
export interface TopBranch {
  name: string;
  code: string;
  count: number;
}

// Main Dashboard Data Interface
export interface DashboardData {
  overallSystem: {
    onlineBranches: number;
    onlineCameras: number;
    offlineCameras: number;
    latestAlerts: number;
    overallEventsGraph: OverallEventsGraphData[];
  };
  topAlertBranches: TopBranch[];

  parkingViolation: {
    currentOverdueCars: number;
    totalEvents: number;
    avgParkingTime: number;
    avgViolationDuration: number;
    topViolatingBranches: TopBranch[];
    graphData: ChartData[];
  };

  tableOccupancy: {
    occupiedTables: number;
    availableTables: number;
    reservedTables: number;
    totalFullBranches: number; // สาขาที่โต๊ะเต็ม
    avgTableUsageTime: number; // เวลาเฉลี่ยใช้โต๊ะ
    avgPeoplePerTable: number; // คนที่ใช้โต๊ะเฉลี่ย
    peakUsageTime: string;
    currentAvailable: number;
    graphData: ChartData[];
  };

  chilledBasketAlert: {
    currentAlertBaskets: number;
    totalAlertEvents: number;
    avgUsageTime: number;
    avgOutOfZoneTime: number;
    topAlertingBranches: TopBranch[];
    graphData: ChartData[];
  };
}

export const fetchDashboardData = async (
  date: Date,
  period: 'day' | 'week' | 'month'
): Promise<DashboardData> => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const generateMockData = (): DashboardData => {
    // Static "current" values (independent of time filter)
    const staticCurrentValues = {
      currentOverdueCars: 12, // Example static value
      currentOccupiedTables: 188, // Example static value
      currentAlertBaskets: 36, // Example static value
    };

    const base: DashboardData = {
      overallSystem: {
        onlineBranches: 3000,
        onlineCameras: 16000,
        offlineCameras: 2000,
        latestAlerts: 234,
        overallEventsGraph: [], // Will be populated based on period
      },
      topAlertBranches: [
        { name: 'สาขาสุขุมวิท 63', code: '821', count: 22 },
        { name: 'สาขาลาดพร้าว', code: '943', count: 19 },
        { name: 'สาขาปิ่นเกล้า', code: '1104', count: 17 },
        { name: 'สาขาแยกบางนา', code: '1247', count: 16 },
        { name: 'สาขาราชพฤกษ์', code: '10119', count: 14 },
      ],
      parkingViolation: {
        currentOverdueCars: staticCurrentValues.currentOverdueCars,
        totalEvents: 0, // Will be populated based on period
        avgParkingTime: 0, // Will be populated based on period
        avgViolationDuration: 0, // Will be populated based on period
        topViolatingBranches: [], // Will be populated based on period
        graphData: [], // Will be populated based on period
      },
      tableOccupancy: {
        occupiedTables: 188,
        availableTables: 44,
        reservedTables: 16,
        totalFullBranches: 0, // Will be populated based on period
        avgTableUsageTime: 0, // Will be populated based on period
        avgPeoplePerTable: 0, // Will be populated based on period
        peakUsageTime: '', // Will be populated based on period
        currentAvailable: 3,
        graphData: [], // Will be populated based on period
      },
      chilledBasketAlert: {
        currentAlertBaskets: staticCurrentValues.currentAlertBaskets,
        totalAlertEvents: 0, // Will be populated based on period
        avgUsageTime: 0, // Will be populated based on period
        avgOutOfZoneTime: 0, // Will be populated based on period
        topAlertingBranches: [], // Will be populated based on period
        graphData: [], // Will be populated based on period
      },
    };

    if (period === 'day') {
      base.overallSystem.overallEventsGraph = [
        { label: '00:00', parking: 5, table: 2, chilledBasket: 3 },
        { label: '04:00', parking: 3, table: 1, chilledBasket: 2 },
        { label: '08:00', parking: 15, table: 8, chilledBasket: 10 },
        { label: '12:00', parking: 25, table: 18, chilledBasket: 20 },
        { label: '16:00', parking: 20, table: 12, chilledBasket: 15 },
        { label: '20:00', parking: 12, table: 8, chilledBasket: 10 },
      ];
      base.parkingViolation.totalEvents = 128;
      base.parkingViolation.avgParkingTime = 12.5;
      base.parkingViolation.avgViolationDuration = 8;
      base.parkingViolation.topViolatingBranches = [
        { name: 'สาขาทองหล่อ', code: '1011', count: 10 },
        { name: 'สาขาสีลม', code: '1022', count: 8 },
        { name: 'สาขาพระราม 9', code: '1033', count: 7 },
      ];
      base.parkingViolation.graphData = [
        { label: '00:00', count: 5 }, { label: '04:00', count: 3 }, { label: '08:00', count: 15 },
        { label: '12:00', count: 25 }, { label: '16:00', count: 20 }, { label: '20:00', count: 12 },
      ];

      // Table Occupancy - Day Data
      base.tableOccupancy.totalFullBranches = 44; // สาขาที่โต๊ะเต็ม
      base.tableOccupancy.avgTableUsageTime = 12; // เวลาเฉลี่ยใช้โต๊ะ
      base.tableOccupancy.avgPeoplePerTable = 3; // คนที่ใช้โต๊ะเฉลี่ย
      base.tableOccupancy.peakUsageTime = '12:00 - 14:00 น.';
      base.tableOccupancy.graphData = [
        { label: '00:00', count: 5 }, { label: '04:00', count: 10 }, { label: '08:00', count: 20 },
        { label: '12:00', count: 40 }, { label: '16:00', count: 30 }, { label: '20:00', count: 15 },
      ];

      base.chilledBasketAlert.totalAlertEvents = 88;
      base.chilledBasketAlert.avgUsageTime = 27.5;
      base.chilledBasketAlert.avgOutOfZoneTime = 44;
      base.chilledBasketAlert.topAlertingBranches = [
        { name: 'สาขาพระโขนง', code: '10053', count: 8 },
        { name: 'สาขาเอกมัย', code: '10119', count: 5 },
        { name: 'สาขาอโศก', code: '10329', count: 3 },
      ];
      base.chilledBasketAlert.graphData = [
        { label: '00:00', count: 2 }, { label: '04:00', count: 1 }, { label: '08:00', count: 5 },
        { label: '12:00', count: 8 }, { label: '16:00', count: 6 }, { label: '20:00', count: 3 },
      ];

    } else if (period === 'week') {
      base.overallSystem.overallEventsGraph = [
        { label: 'จันทร์', parking: 15, table: 8, chilledBasket: 12 },
        { label: 'อังคาร', parking: 18, table: 12, chilledBasket: 15 },
        { label: 'พุธ', parking: 22, table: 15, chilledBasket: 18 },
        { label: 'พฤหัส', parking: 25, table: 18, chilledBasket: 22 },
        { label: 'ศุกร์', parking: 30, table: 20, chilledBasket: 25 },
        { label: 'เสาร์', parking: 20, table: 14, chilledBasket: 16 },
        { label: 'อาทิตย์', parking: 16, table: 10, chilledBasket: 12 },
      ];
      base.parkingViolation.totalEvents = 420;
      base.parkingViolation.avgParkingTime = 10.2;
      base.parkingViolation.avgViolationDuration = 7.5;
      base.parkingViolation.topViolatingBranches = [
        { name: 'สาขาทองหล่อ', code: '1011', count: 35 },
        { name: 'สาขาสีลม', code: '1022', count: 28 },
        { name: 'สาขาพระราม 9', code: '1033', count: 22 },
      ];
      base.parkingViolation.graphData = [
        { label: 'จันทร์', count: 15 }, { label: 'อังคาร', count: 18 }, { label: 'พุธ', count: 22 },
        { label: 'พฤหัส', count: 25 }, { label: 'ศุกร์', count: 30 }, { label: 'เสาร์', count: 20 }, { label: 'อาทิตย์', count: 16 },
      ];

      // Table Occupancy - Week Data
      base.tableOccupancy.totalFullBranches = 150;
      base.tableOccupancy.avgTableUsageTime = 10;
      base.tableOccupancy.avgPeoplePerTable = 3.5;
      base.tableOccupancy.peakUsageTime = '12:00 - 14:00 น.';
      base.tableOccupancy.graphData = [
        { label: 'จันทร์', count: 80 }, { label: 'อังคาร', count: 90 }, { label: 'พุธ', count: 100 },
        { label: 'พฤหัส', count: 110 }, { label: 'ศุกร์', count: 120 }, { label: 'เสาร์', count: 90 }, { label: 'อาทิตย์', count: 70 },
      ];

      base.chilledBasketAlert.totalAlertEvents = 350;
      base.chilledBasketAlert.avgUsageTime = 25.1;
      base.chilledBasketAlert.avgOutOfZoneTime = 40;
      base.chilledBasketAlert.topAlertingBranches = [
        { name: 'สาขาพระโขนง', code: '10053', count: 25 },
        { name: 'สาขาเอกมัย', code: '10119', count: 18 },
        { name: 'สาขาอโศก', code: '10329', count: 12 },
      ];
      base.chilledBasketAlert.graphData = [
        { label: 'จันทร์', count: 10 }, { label: 'อังคาร', count: 12 }, { label: 'พุธ', count: 15 },
        { label: 'พฤหัส', count: 18 }, { label: 'ศุกร์', count: 20 }, { label: 'เสาร์', count: 15 }, { label: 'อาทิตย์', count: 10 },
      ];

    } else { // month
      base.overallSystem.overallEventsGraph = [
        { label: 'สัปดาห์ 1', parking: 120, table: 80, chilledBasket: 100 },
        { label: 'สัปดาห์ 2', parking: 135, table: 95, chilledBasket: 115 },
        { label: 'สัปดาห์ 3', parking: 150, table: 110, chilledBasket: 130 },
        { label: 'สัปดาห์ 4', parking: 140, table: 105, chilledBasket: 125 },
      ];
      base.parkingViolation.totalEvents = 1500;
      base.parkingViolation.avgParkingTime = 11.0;
      base.parkingViolation.avgViolationDuration = 7.0;
      base.parkingViolation.topViolatingBranches = [
        { name: 'สาขาทองหล่อ', code: '1011', count: 120 },
        { name: 'สาขาสีลม', code: '1022', count: 90 },
        { name: 'สาขาพระราม 9', code: '1033', count: 75 },
      ];
      base.parkingViolation.graphData = [
        { label: 'สัปดาห์ 1', count: 120 }, { label: 'สัปดาห์ 2', count: 135 }, { label: 'สัปดาห์ 3', count: 150 }, { label: 'สัปดาห์ 4', count: 140 },
      ];

      // Table Occupancy - Month Data
      base.tableOccupancy.totalFullBranches = 500;
      base.tableOccupancy.avgTableUsageTime = 11.5;
      base.tableOccupancy.avgPeoplePerTable = 4.0;
      base.tableOccupancy.peakUsageTime = '12:00 - 14:00 น.';
      base.tableOccupancy.graphData = [
        { label: 'สัปดาห์ 1', count: 400 }, { label: 'สัปดาห์ 2', count: 450 },
        { label: 'สัปดาห์ 3', count: 500 }, { label: 'สัปดาห์ 4', count: 480 },
      ];

      base.chilledBasketAlert.totalAlertEvents = 600;
      base.chilledBasketAlert.avgUsageTime = 26.0;
      base.chilledBasketAlert.avgOutOfZoneTime = 42;
      base.chilledBasketAlert.topAlertingBranches = [
        { name: 'สาขาพระโขนง', code: '10053', count: 80 },
        { name: 'สาขาเอกมัย', code: '10119', count: 60 },
        { name: 'สาขาอโศก', code: '10329', count: 45 },
      ];
      base.chilledBasketAlert.graphData = [
        { label: 'สัปดาห์ 1', count: 50 }, { label: 'สัปดาห์ 2', count: 60 },
        { label: 'สัปดาห์ 3', count: 70 }, { label: 'สัปดาห์ 4', count: 65 },
      ];
    }
    return base;
  };

  return generateMockData();
};