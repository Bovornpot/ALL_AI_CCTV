import React, {useState} from 'react';
// import { ChevronRight } from 'lucide-react';
import ParkingAlertCard from '../common/ParkingAlertCard';

// import { TopBranchData } from '../../types/parkingViolation'; // ใช้ Type ที่เราสร้างไว้
import { TimeSelection } from '../../types/time';
import { getDateRangeFromSelection } from '../../utils/dateUtils';
import AllBranchesModal from './AllBranchesModal'; // Import Modal component

interface BranchData {
  name: string;
  code: string;
  count: number;
}

interface TopBranchesListProps {
  data: BranchData[];
  timeSelection: TimeSelection;
}

const getLocalDateString = (date: Date) =>
  date.toLocaleDateString('sv-SE'); // ✅ ใช้ local date เช่น "2025-10-07"

const TopBranchesList: React.FC<TopBranchesListProps> = ({ data, timeSelection }) => {
  //สร้าง State สำหรับจัดการการเปิด/ปิด Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // คำนวณ Filters เพื่อส่งให้ Modal (ทำเหมือนในหน้าหลัก)
  const { startDate, endDate } = getDateRangeFromSelection(timeSelection);
  const filters = {
    startDate: getLocalDateString(startDate),
    endDate: getLocalDateString(endDate),
  };

  return (
    <>
      {/* สร้างส่วนหัวขึ้นมาใหม่ */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Top 5 Violating Branches
        </h3>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="text-sm font-semibold text-gray-500 hover:underline" 
        >
          ดูเพิ่มเติม
        </button>
      </div>

      <div className="flex-grow flex flex-col justify-start space-y-2">
        {/* ส่วนของการแสดง Top 5 ยังคงเหมือนเดิม */}
        {data.map((branch, index) => (
          <ParkingAlertCard
            key={index}
            title={branch.name}
            count={branch.count}
            subtitle={`รหัสร้าน ${branch.code}`} // ส่งรหัสร้านไปที่ subtitle
            bgColor="bg-red-50"                 // ใช้สีแดงเพื่อสื่อถึง Violation
            textColor="text-red-600"
          />
        ))}
      </div>

      {/* แสดง Modal เมื่อ isModalOpen เป็น true */}
      {isModalOpen && (
        <AllBranchesModal 
          onClose={() => setIsModalOpen(false)} 
          filters={filters} 
        />
      )}
    </>
  );
};

export default TopBranchesList;