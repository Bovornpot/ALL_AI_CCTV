import React, { useState, useEffect } from 'react';
import { PaginatedTopBranchResponse } from '../../types/parkingViolation';
import { ViolationFilters, fetchAllBranchViolations } from '../../api/parkingApiService';

interface AllBranchesModalProps {
  onClose: () => void;
  filters: ViolationFilters;
}

const AllBranchesModal: React.FC<AllBranchesModalProps> = ({ onClose, filters }) => {
  const [data, setData] = useState<PaginatedTopBranchResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // ✅ เพิ่ม state สำหรับ error

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchAllBranchViolations(currentPage, filters);
        setData(result);
      } catch (err: any) {
        console.error('Failed to load all branches:', err);
        // ✅ กรองข้อความ error ให้สื่อความเข้าใจได้
        if (err.message?.includes('Failed to fetch')) {
          setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (CORS หรือเครือข่าย)');
        } else if (err.message?.includes('AUTHENTICATION_REQUIRED')) {
          setError('Session หมดอายุ กรุณาเข้าสู่ระบบใหม่');
        } else {
          setError('เกิดข้อผิดพลาดขณะโหลดข้อมูล');
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [currentPage, filters]);

  // --- ส่วน Render ที่ตกแต่งใหม่ ---
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-2xl font-bold text-gray-800">All Violating Branches</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto">
          {/* ✅ Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* ✅ Error State */}
          {!isLoading && error && (
            <div className="text-center py-10 text-red-600 font-semibold">
              <p>{error}</p>
              <button
                onClick={() => setCurrentPage(1)} // รีเฟรชหน้าแรก
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                ลองใหม่อีกครั้ง
              </button>
            </div>
          )}

          {/* ✅ Empty State */}
          {!isLoading && !error && data && data.branches.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              <p>ไม่มีข้อมูลสาขาในช่วงเวลานี้</p>
            </div>
          )}

          {/* ✅ Data Loaded */}
          {!isLoading && !error && data && data.branches.length > 0 && (
            <div className="space-y-3">
              {data.branches.map((branch, index) => (
                <div key={branch.code} className="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                  <div className="flex items-center">
                    <span className="text-base font-medium text-gray-500 w-10">
                      {((currentPage - 1) * 10) + index + 1}.
                    </span>
                    <div>
                      <p className="font-semibold text-gray-800">{branch.name}</p>
                      <p className="text-sm text-gray-500 font-mono">รหัสร้าน {branch.code}</p>
                    </div>
                  </div>
                  <span className="px-4 py-1 bg-red-100 text-red-700 text-base font-bold rounded-full">
                    {branch.count}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ✅ Pagination */}
          {!isLoading && !error && data && data.total_pages > 1 && (
            <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl mt-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                >
                  Previous
                </button>
                <span className="text-base text-gray-700">
                  Page {data.current_page} of {data.total_pages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, data.total_pages))}
                  disabled={currentPage >= data.total_pages}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllBranchesModal;
