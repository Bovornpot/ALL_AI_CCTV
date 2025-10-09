import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

interface ChartData {
  label: string;
  violations: number;
  total: number;
}

interface ViolationsChartProps {
  data: ChartData[];
}

const ViolationsChart: React.FC<ViolationsChartProps> = ({ data }) => {
  const [showViolations, setShowViolations] = useState(true);
  const [showTotal, setShowTotal] = useState(true);

  return (
    <div style={{ width: '100%', height: 320 }} className="bg-white rounded-lg p-4">
      {/* Custom Legend with Checkboxes */}
      <div className="flex gap-6 mb-4 justify-center">
        {/* Checkbox สำหรับ 'รถจอดเกิน' (สีแดง) */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={showViolations}
              onChange={() => setShowViolations(!showViolations)}
              // ใช้ accent-red-500 เพื่อกำหนดสีของ Checkbox ให้เป็นสีแดง
              // เพิ่ม class 'opacity-100' และใช้ style เพื่อควบคุมความทึบของ Checkbox ทั้งหมด
              className={`w-4 h-4 cursor-pointer accent-red-500 transition-opacity ${showViolations ? 'opacity-100' : 'opacity-50'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
              รถจอดเกิน
            </span>
          </div>
        </label>
        
        {/* Checkbox สำหรับ 'รถทั้งหมด' (สีน้ำเงิน) */}
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              checked={showTotal}
              onChange={() => setShowTotal(!showTotal)}
              // ใช้ accent-blue-500 เพื่อกำหนดสีของ Checkbox ให้เป็นสีน้ำเงิน
              // เพิ่ม class 'opacity-100' และใช้ style เพื่อควบคุมความทึบของ Checkbox ทั้งหมด
              className={`w-4 h-4 cursor-pointer accent-blue-500 transition-opacity ${showTotal ? 'opacity-100' : 'opacity-50'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            {/* <<< ลบ Div สี่เหลี่ยมสีน้ำเงินออกไปแล้ว >>> */}
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
              รถทั้งหมด
            </span>
          </div>
        </label>
      </div>

      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="label" 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
          />
          {showViolations && (
            <Bar 
              dataKey="violations" 
              fill="#ef4444" 
              name="รถจอดเกิน"
              radius={[4, 4, 0, 0]}
              animationDuration={800}
            />
          )}
          {showTotal && (
            <Bar 
              dataKey="total" 
              fill="#3b82f6" 
              name="รถทั้งหมด"
              radius={[4, 4, 0, 0]}
              animationDuration={800}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ViolationsChart;
