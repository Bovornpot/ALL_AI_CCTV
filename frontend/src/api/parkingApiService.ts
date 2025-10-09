// frontend/src/api/parkingApiService.ts
import {
  ViolationSummaryResponse,
  PaginatedViolationEventsResponse,
  PaginatedTopBranchResponse
} from '../types/parkingViolation';


// อ่าน URL ของ Backend จาก .env
// const API_BASE_URL = process.env.REACT_APP_API_URL;
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:3000';
console.log(`✅ API_BASE_URL in use: ${API_BASE_URL}`);

// สร้าง Type สำหรับหน่วยการจัดกลุ่ม
export type ChartGroupByUnit = 'hour' | 'day' | 'week' | 'month' | 'week_range' | 'month_range';

// สร้าง Interface สำหรับ Filters เพื่อความปลอดภัยของ Type
export interface ViolationFilters {
  branchId?: string;
  startDate?: string; // Format: YYYY-MM-DD
  endDate?: string;   // Format: YYYY-MM-DD
  isViolationOnly?: boolean;
  inProgressOnly?: boolean; //สำหรับ Tabกำลังจอด
  groupByUnit?: ChartGroupByUnit;
}

// ฟังก์ชันยูทิลิตี้สำหรับจัดการ Response
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ HTTP Error: ${response.status}`, errorText);

    if (response.status === 401 || response.status === 403) {
      throw new Error("AUTHENTICATION_REQUIRED: Session expired or invalid credentials.");
    }

    throw new Error(`Fetch failed (${response.status}): ${errorText.substring(0, 100)}...`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) return response.json();

  const nonJson = await response.text();
  console.warn("⚠️ Non-JSON response:", nonJson.substring(0, 50));
  throw new SyntaxError(`Expected JSON but received non-JSON. Type: ${contentType || 'None'}`);
};

/**
 * ฟังก์ชันสำหรับดึงข้อมูลสรุป (KPI, Chart, Top Branches)
 * @param filters - Object ที่มีเงื่อนไขการกรอง
 */
export const fetchViolationSummary = async (filters: ViolationFilters): Promise<ViolationSummaryResponse> => {
  // สร้าง URLSearchParams เพื่อจัดการ Query String อย่างปลอดภัย
  const params = new URLSearchParams();
  if (filters.branchId) params.append('branch_id', filters.branchId);
  if (filters.startDate) params.append('start_date', filters.startDate);
  if (filters.endDate) params.append('end_date', filters.endDate);
  if (filters.groupByUnit) params.append('group_by_unit', filters.groupByUnit); 

  const queryString = params.toString();

  // นำ queryString ไปต่อท้าย URL
  const response = await fetch(`${API_BASE_URL}/parking_violations/summary?${queryString}`);
  
  // ใช้ handleResponse แทนการตรวจสอบ response.ok และ .json() ทันที
    return handleResponse(response);
};

//ฟังก์ชันสำหรับดึงข้อมูลสรุป Top Branches ทั้งหมด
export const fetchAllBranchViolations = async (page: number, filters: ViolationFilters): Promise<PaginatedTopBranchResponse> => {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('start_date', filters.startDate);
  if (filters.endDate) params.append('end_date', filters.endDate);
  
  const response = await fetch(`${API_BASE_URL}/parking_violations/all_branches?page=${page}&limit=10&${params.toString()}`);
  
  // ใช้ handleResponse แทนการตรวจสอบ response.ok และ .json() ทันที
    return handleResponse(response);
};

/**
 * ฟังก์ชันสำหรับดึงข้อมูลรายการเหตุการณ์ (สำหรับตาราง)
 * @param page - เลขหน้า
 * @param limit - จำนวนรายการต่อหน้า
 * @param filters - Object ที่มีเงื่อนไขการกรอง
 */
export const fetchViolationEvents = async (page: number, limit: number, filters: ViolationFilters): Promise<PaginatedViolationEventsResponse> => {
  // สร้าง URLSearchParams เช่นกัน
  const params = new URLSearchParams();
  if (filters.branchId) params.append('branch_id', filters.branchId);
  if (filters.startDate) params.append('start_date', filters.startDate);
  if (filters.endDate) params.append('end_date', filters.endDate);
  if (filters.isViolationOnly) params.append('is_violation_only', 'true');
  if (filters.inProgressOnly) params.append('in_progress_only', 'true'); //สำหรับ Tabกำลังจอด

  const queryString = params.toString();
  
  // นำ queryString ไปต่อท้าย URL
  const response = await fetch(`${API_BASE_URL}/parking_violations/events?page=${page}&limit=${limit}&${queryString}`);

  // ใช้ handleResponse แทนการตรวจสอบ response.ok และ .json() ทันที
    return handleResponse(response);
};