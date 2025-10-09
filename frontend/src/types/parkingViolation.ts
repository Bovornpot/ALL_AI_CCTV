// frontend/src/types/parkingViolation.ts

export type ViolationStatus = 'Violate' | 'Normal';

export interface ParkingViolationEvent {
  id: number;
  status: ViolationStatus;
  timestamp: string; // ISO 8601 format
  branch: {
    id: string;
    name: string;
  };
  camera: {
    id:string;
  };
  vehicleId: string;
  entryTime: string; // ISO 8601 format
  exitTime: string | null;
  durationMinutes: number;
  isViolation: boolean;
  total_parking_sessions: number;
  imageUrl?: string;
}

export interface ParkingKpiData {
  totalViolations: number;
  total_parking_sessions: number;
  ongoingViolations: number;
  avgViolationDuration: number; // in minutes
  avgNormalParkingTime: number; // in minutes
  onlineBranches: number;
}

export interface ViolationChartDataPoint {
  label: string; // ตรงกับ time_label ใน backend
  value: number; // ตรงกับ violation_count ใน backend
  total: number; // จำนวนทั้งหมด (session ทั้งหมด)
}

export interface TopBranchData {
  name: string;  // ตรงกับ branch_name
  code: string;  // ตรงกับ branch_id
  count: number; // ตรงกับ violation_count
}

export interface ViolationSummaryResponse {
  kpi: ParkingKpiData;
  chart_data: ViolationChartDataPoint[];
  top_branches: TopBranchData[];
}

export interface PaginatedTopBranchResponse {
  total_items: number;
  total_pages: number;
  current_page: number;
  branches: TopBranchData[];
}

export interface PaginatedViolationEventsResponse {
  total_items: number;
  total_pages: number;
  current_page: number;
  events: ParkingViolationEvent[];
}

