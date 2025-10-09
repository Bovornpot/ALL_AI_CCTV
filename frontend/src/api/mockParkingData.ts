// src/api/mockParkingData.ts

import { ParkingViolationEvent, ParkingKpiData } from '../types/parkingViolation';

// --- Data for KPI Cards ---
export const mockKpiData: ParkingKpiData = {
  totalViolations: 1256,
  total_parking_sessions: 4356,
  ongoingViolations: 78,
  avgViolationDuration: 35,
  avgNormalParkingTime: 12,
  onlineBranches: 5
};

// --- Data for Violations Table ---
export const mockViolationData: ParkingViolationEvent[] = [
  {
    id: 1, status: 'Violate', timestamp: '2025-07-24T11:10:00Z',
    branch: { id: 'BKK01', name: 'สาขาสุขุมวิท' }, camera: { id: 'Cam01' },
    vehicleId: 'กท-1234', entryTime: '2025-07-24T08:30:00Z', exitTime: null,
    durationMinutes: 160, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/400x300.png?text=Violation+BKK01'
  },
  {
    id: 2, status: 'Violate', timestamp: '2025-07-24T11:05:00Z',
    branch: { id: 'BKK02', name: 'สาขาลาดพร้าว' }, camera: { id: 'Cam05' },
    vehicleId: 'ขข-5678', entryTime: '2025-07-24T10:45:00Z', exitTime: null,
    durationMinutes: 20, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/400x300.png?text=Violation+BKK02'
  },
  {
    id: 3, status: 'Normal', timestamp: '2025-07-23T15:00:00Z',
    branch: { id: 'BKK01', name: 'สาขาสุขุมวิท' }, camera: { id: 'Cam02' },
    vehicleId: 'คค-9012', entryTime: '2025-07-23T14:00:00Z', exitTime: '2025-07-23T15:00:00Z',
    durationMinutes: 60, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/400x300.png?text=Violation+BKK01'
  },
  {
    id: 4, status: 'Violate', timestamp: '2025-07-10T11:45:00Z',
    branch: { id: 'BKK03', name: 'สาขาปิ่นเกล้า' }, camera: { id: 'Cam02' },
    vehicleId: 'คค-9012', entryTime: '2025-07-10T10:00:00Z', exitTime: '2025-07-10T11:45:00Z',
    durationMinutes: 105, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/150'
  },
  {
    id: 5, status: 'Normal', timestamp: '2025-07-11T17:30:00Z',
    branch: { id: 'BKK01', name: 'สาขาสุขุมวิท' }, camera: { id: 'Cam01' },
    vehicleId: 'กท-1234', entryTime: '2025-07-11T14:30:00Z', exitTime: null,
    durationMinutes: 180, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/150'
  },
  {
    id: 6, status: 'Normal', timestamp: '2025-07-11T15:10:00Z',
    branch: { id: 'BKK02', name: 'สาขาลาดพร้าว' }, camera: { id: 'Cam05' },
    vehicleId: 'ขข-5678', entryTime: '2025-07-11T13:00:00Z', exitTime: '2025-07-11T15:10:00Z',
    durationMinutes: 130, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/150'
  },
  {
    id: 7, status: 'Normal', timestamp: '2025-07-10T11:45:00Z',
    branch: { id: 'BKK03', name: 'สาขาปิ่นเกล้า' }, camera: { id: 'Cam02' },
    vehicleId: 'คค-9012', entryTime: '2025-07-10T10:00:00Z', exitTime: '2025-07-10T11:45:00Z',
    durationMinutes: 105, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/150'
  },
  {
    id: 8, status: 'Normal', timestamp: '2025-07-23T15:00:00Z',
    branch: { id: 'BKK01', name: 'สาขาสุขุมวิท' }, camera: { id: 'Cam02' },
    vehicleId: 'คค-9012', entryTime: '2025-07-23T14:00:00Z', exitTime: '2025-07-23T15:00:00Z',
    durationMinutes: 60, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/400x300.png?text=Violation+BKK01'
  },
  {
    id: 9, status: 'Normal', timestamp: '2025-07-23T15:00:00Z',
    branch: { id: 'BKK01', name: 'สาขาสุขุมวิท' }, camera: { id: 'Cam02' },
    vehicleId: 'คค-9012', entryTime: '2025-07-23T14:00:00Z', exitTime: '2025-07-23T15:00:00Z',
    durationMinutes: 60, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/400x300.png?text=Violation+BKK01'
  },
   {
    id: 10, status: 'Violate', timestamp: '2025-07-24T11:10:00Z',
    branch: { id: 'BKK01', name: 'สาขาสุขุมวิท' }, camera: { id: 'Cam01' },
    vehicleId: 'กท-1234', entryTime: '2025-07-24T08:30:00Z', exitTime: null,
    durationMinutes: 160, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/400x300.png?text=Violation+BKK01'
  },
  {
    id: 11, status: 'Violate', timestamp: '2025-07-24T11:05:00Z',
    branch: { id: 'BKK02', name: 'สาขาลาดพร้าว' }, camera: { id: 'Cam05' },
    vehicleId: 'ขข-5678', entryTime: '2025-07-24T10:45:00Z', exitTime: null,
    durationMinutes: 20, isViolation: true, total_parking_sessions: 10, //evidenceImageUrl: 'https://via.placeholder.com/400x300.png?text=Violation+BKK02'
  },
];

export const mockTopBranches = [
  { name: 'สาขาสุขุมวิท', code: 'BKK01', count: 128 },
  { name: 'สาขาลาดพร้าว', code: 'BKK02', count: 95 },
  { name: 'สาขาปิ่นเกล้า', code: 'BKK03', count: 88 },
  { name: 'สาขาสีลม', code: 'BKK04', count: 76 },
  { name: 'สาขาพระราม 9', code: 'BKK05', count: 62 },
];


// --- Data for Violations Chart ---
interface ChartPoint {
  label: string;
  value: number;
}

// กรณีเลือกวันเดียว (แสดงรายชั่วโมง)
export const mockSingleDayChartData: ChartPoint[] = [
  { label: '00:00', value: 3 },
  { label: '01:00', value: 3 },
  { label: '02:00', value: 3 },
  { label: '03:00', value: 3 },
  { label: '04:00', value: 3 }, 
  { label: '05:00', value: 8 }, 
  { label: '06:00', value: 15 }, 
  { label: '07:00', value: 11 },
  { label: '08:00', value: 3 }, 
  { label: '09:00', value: 8 }, 
  { label: '10:00', value: 15 }, 
  { label: '11:00', value: 11 },
  { label: '12:00', value: 7 }, 
  { label: '13:00', value: 9 },
  { label: '14:00', value: 3 }, 
  { label: '15:00', value: 8 }, 
  { label: '16:00', value: 15 }, 
  { label: '17:00', value: 11 },
  { label: '18:00', value: 7 }, 
  { label: '19:00', value: 9 },
  { label: '20:00', value: 9 },
  { label: '21:00', value: 9 },
  { label: '22:00', value: 9 },
  { label: '23:00', value: 9 },
];

export const mockRangeDayChartData: ChartPoint[] = [
  { label: '1 ก.ค', value: 10 },
  { label: '2 ก.ค.', value: 14 },
  { label: '3 ก.ค.', value: 15 },
  { label: '4 ก.ค.', value: 12 },
];

// กรณีเลือกช่วงวัน หรือ สัปดาห์เดียว (แสดงรายวัน)
export const mockSingleWeekChartData: ChartPoint[] = [
  { label: '21 ก.ค.', value: 45 }, 
  { label: '22 ก.ค.', value: 62 }, 
  { label: '23 ก.ค.', value: 51 }, 
  { label: '24 ก.ค.', value: 77 },
  { label: '25 ก.ค.', value: 55 },
  { label: '26 ก.ค.', value: 77 },
  { label: '27 ก.ค.', value: 55 },
];

// กรณีเลือกช่วงสัปดาห์ (แสดงรายสัปดาห์)
export const mockRangeWeekChartData: ChartPoint[] = [
  { label: 'W28', value: 250 }, 
  { label: 'W29', value: 310 }, 
  { label: 'W30', value: 280 }, 
  { label: 'W31', value: 300 },
];

export const mockSingleMonthChartData: ChartPoint[] = [
  { label: '01/07/2025', value: 1150 },
  { label: '02/07/2025', value: 1420 },
  { label: '03/07/2025', value: 1280 },
  { label: '04/07/2025', value: 1150 },
  { label: '05/07/2025', value: 1420 },
  { label: '06/07/2025', value: 1280 },
  { label: '07/07/2025', value: 1150 },
  { label: '08/07/2025', value: 1420 },
  { label: '09/07/2025', value: 1280 },
  { label: '10/07/2025', value: 1150 },
  { label: '11/07/2025', value: 1420 },
  { label: '12/07/2025', value: 1280 },
  { label: '13/07/2025', value: 1150 },
  { label: '14/07/2025', value: 1420 },
  { label: '15/07/2025', value: 1280 },
  { label: '16/07/2025', value: 1150 },
  { label: '17/07/2025', value: 1420 },
  { label: '18/07/2025', value: 1280 },
  { label: '19/07/2025', value: 1150 },
  { label: '20/07/2025', value: 1420 },
  { label: '21/07/2025', value: 1280 },
  { label: '22/07/2025', value: 1420 },
  { label: '23/07/2025', value: 1280 },
  { label: '24/07/2025', value: 1420 },
  { label: '25/07/2025', value: 1280 },
  { label: '26/07/2025', value: 1420 },
  { label: '27/07/2025', value: 1280 },
  { label: '28/07/2025', value: 1420 },
  { label: '29/07/2025', value: 1280 },
  { label: '30/07/2025', value: 1280 },
];

export const mockRangeMonthChartData: ChartPoint[] = [
  { label: 'พ.ค.', value: 1150 },
  { label: 'มิ.ย.', value: 1420 },
  { label: 'ก.ค.', value: 1280 },
];

