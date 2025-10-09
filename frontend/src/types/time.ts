// frontend/src/types/time.ts

export type TimeSelection = {
  activeTab: 'Day' | 'Week' | 'Month';
  mode: 'single' | 'range';
} & (
  | {
      activeTab: 'Day';
      startDate: Date;
      endDate: Date; // For range mode, otherwise same as startDate
    }
  | {
      activeTab: 'Week';
      year: number;
      week: number; // For single mode
      startWeek: number; // For range mode
      endWeek: number; // For range mode
    }
  | {
      activeTab: 'Month';
      year: number;
      month: number; // For single mode
      startMonth: number; // For range mode
      endMonth: number; // For range mode
    }
);