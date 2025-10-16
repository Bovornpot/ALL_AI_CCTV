// frontend/src/components/parking/ViolationsTable.tsx

import React, { useState } from 'react';
import { ParkingViolationEvent, ViolationStatus } from '../../types/parkingViolation';
import './ViolationsTable.css'; // เราจะสร้างไฟล์ CSS นี้ในขั้นตอนถัดไป

// Helper component สำหรับแสดงสถานะพร้อมสี
const StatusBadge: React.FC<{ status: ViolationStatus }> = ({ status }) => {
  const statusInfo = {
    Violate: { text: 'Violate', colorClass: 'status-violate' },
    Normal: { text: 'Normal', colorClass: 'status-normal' },
  };

  const { text, colorClass } = statusInfo[status];

  return (
    <div className="status-badge-container">
      <span className={`status-dot ${colorClass}`}></span>
      <span>{text}</span>
    </div>
  );
};

// Helper function สำหรับจัดรูปแบบวันที่
const formatDateTime = (isoString: string | null) => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function buildIP(num: string): string {
  let ipPrefix = "117";
  let url = "";
  let lastOctet = ".9";

  if (num.length === 1) {
    url = `${ipPrefix}.100.10${num}${lastOctet}`;
  } else if (num.length === 2) {
    url = `${ipPrefix}.100.1${num}${lastOctet}`;
  } else if (num.length === 3) {
    url = `${ipPrefix}.10${num.charAt(0)}.1${num.substr(1)}${lastOctet}`;
  } else if (num.length === 4) {
    url = `${ipPrefix}.1${num.substr(0, 2)}.1${num.substr(2)}${lastOctet}`;
  } else if (num.length === 5 && ipPrefix === "117") {
    if (num.charAt(0) === "1") {
      url = `111.1${num.substr(1, 2)}.1${num.substr(3)}${lastOctet}`;
    } else {
      url = `11${num.charAt(0)}.1${num.substr(1, 2)}.1${num.substr(3)}${lastOctet}`;
    }
  } else {
    url = num;
  }

  return url;
}

// --- เพิ่ม helper สำหรับคำนวณ link จาก branch id ---
function getCameraLinkFromBranch(branchId: string | number | undefined): string | null {
  if (branchId === undefined || branchId === null) return null;
  const idStr = String(branchId).trim();
  if (!idStr) return null;

  const ipOrSegment = buildIP(idStr); // ใช้ฟังก์ชัน buildIP ที่คุณให้มา
  // ถ้าฟังก์ชัน buildIP คืนค่าเป็น IP หรือ URL แบบเต็ม เราใช้ตรง ๆ
  // ถ้าเป็นแค่ IP segment เราสามารถ prepend scheme เช่น http:// หรือ rtsp:// ตามต้องการ
  // ตัวอย่างนี้ใช้ http:// เป็น default แต่คุณสามารถเปลี่ยนเป็น rtsp:// ได้ตามความต้องการ
  const maybeIp = ipOrSegment || idStr;
  // ถ้าค่าที่ได้ดูเหมือนมี scheme แล้ว ให้ใช้ตรง ๆ
  if (/^[a-zA-Z]+:\/\//.test(maybeIp)) return maybeIp;
  return `http://${maybeIp}`; // <-- ปรับเป็น rtsp:// ถ้าต้องการ
}

const EvidenceModal: React.FC<{ violation: ParkingViolationEvent; onClose: () => void }> = ({ violation, onClose }) => {
    if (!violation) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Violation Details (ID: {violation.id})</h3>
                    <button onClick={onClose} className="modal-close-button">&times;</button>
                </div>
                <div className="modal-body">
                    <div className="modal-image-container">
                        {violation.imageUrl ? (
                            <img src={violation.imageUrl} alt="หลักฐาน" />
                        ) : (
                            <p className="text-gray-500 italic">ไม่มีภาพหลักฐาน</p>
                        )}
                    </div>
                    <div className="modal-details">
                        <p><strong>Vehicle ID:</strong> <span className="font-mono">{violation.vehicleId}</span></p>
                        <p><strong>Status:</strong> {violation.status}</p>
                        <p><strong>Branch:</strong> {violation.branch.name} ({violation.branch.id})</p>
                        <p>
                            <strong>Camera Link:</strong>{' '}
                            {getCameraLinkFromBranch(violation.branch?.id) ? (
                                <a
                                href={getCameraLinkFromBranch(violation.branch?.id)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline break-all"
                                >
                                {getCameraLinkFromBranch(violation.branch?.id)!.replace(/^https?:\/\//, '')}
                                </a>
                            ) : (
                                <span className="text-gray-500">-</span>
                            )}
                        </p>
                        <p><strong>Camera IP:</strong> {violation.camera.id}</p>
                        <p><strong>Entry Time:</strong> {formatDateTime(violation.entryTime)}</p>
                        <p><strong>Exit Time:</strong> {formatDateTime(violation.exitTime)}</p>
                        <p><strong>Duration:</strong> {violation.durationMinutes.toFixed(0)} minutes</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

type ActiveTab = 'in-progress' | 'violations' | 'all';
interface ViolationsTableProps {
  violations: ParkingViolationEvent[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

// ฟังก์ชัน Normalize Status
const normalizeStatus = (status?: string) => (status || '').trim().toLowerCase();


const ViolationsTable: React.FC<ViolationsTableProps> = ({ violations, currentPage, totalPages, onPageChange, activeTab ,onTabChange }) => {
//   const [activeTab, setActiveTab] = useState<'all' | 'violations'>('violations');
  const [selectedViolation, setSelectedViolation] = useState<ParkingViolationEvent | null>(null);

    // ฟิลเตอร์ข้อมูลตาม activeTab
    const filteredViolations = violations.filter(v => {
        const status = normalizeStatus(v.status);
        if (activeTab === 'violations') return status === 'violate';
        if (activeTab === 'in-progress') return status === 'violate' && !v.exitTime;
        return true; // all
    });


  return (
        <div>
            {/* --- Tab buttons (เปลี่ยนชื่อ Tab) --- */}
            <div className="tabs-container">
                <button
                    className={`tab-button ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => onTabChange('all')}
                >
                    รถเข้าออกทั้งหมด
                </button>
                <button
                    className={`tab-button ${activeTab === 'in-progress' ? 'active' : ''}`}
                    onClick={() => onTabChange('in-progress')}
                >
                    กำลังจอดรถเกิน
                </button>
                <button
                    className={`tab-button ${activeTab === 'violations' ? 'active' : ''}`}
                    onClick={() => onTabChange('violations')}
                >
                    รถจอดเกินเวลา
                </button>
            </div>

            {/* --- Table (ปรับปรุงคอลัมน์) --- */}
            {filteredViolations.length > 0 ? (
                <div className="table-container">
                    <table className="violations-table">
                        <thead>
                            <tr>
                                <th>ลำดับ</th>    
                                <th>สถานะ</th>
                                <th>ID รถ</th>
                                <th>ชื่อสาขา</th>
                                <th>รหัสสาขา</th>
                                <th>Camera ID</th>
                                <th>Camera Link (IP)</th>
                                <th>เวลาเข้า</th>
                                <th>เวลาออก</th>
                                <th>จำนวนเวลา (นาที)</th>
                                <th>รายละเอียด</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ใช้ข้อมูลที่ผ่านการกรองและเรียงลำดับแล้ว */}
                            {filteredViolations.map((violation, index) => {
                                const cameraLink = getCameraLinkFromBranch(violation.branch?.id);
                                return (
                                <tr key={violation.id}>
                                    <td>{(currentPage - 1) * 50 + index + 1}</td>
                                    <td><StatusBadge status={violation.status} /></td>
                                    <td className="font-mono">{violation.vehicleId}</td>
                                    <td>{violation.branch.name}</td>
                                    <td>{violation.branch.id}</td>
                                    <td>{violation.camera.id}</td>
                                    <td>
                                    {cameraLink ? (
                                        <a
                                        href={cameraLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline break-all"
                                        onClick={(e) => {
                                            // ถ้าต้องการหยุดการเปิดลิงก์บางกรณี ให้จัดการที่นี่
                                        }}
                                        >
                                        {cameraLink.replace(/^https?:\/\//, '')}
                                        </a>
                                    ) : (
                                        <span className="text-gray-500">-</span>
                                    )}
                                    </td>
                                    <td>{formatDateTime(violation.entryTime)}</td>
                                    <td>{formatDateTime(violation.exitTime)}</td>
                                    <td>
                                    {Number.isFinite(violation.durationMinutes)
                                        ? `${violation.durationMinutes.toFixed(0)} นาที`
                                        : '-'}
                                    </td>
                                    <td>
                                    <button
                                        className="action-button view-button"
                                        onClick={() => setSelectedViolation(violation)}
                                    >
                                        View
                                    </button>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {/* 2. เพิ่มส่วนของ Pagination UI */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between p-4 border-t border-gray-200">
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-gray-700">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                        </div>
                    )}
                </div>
            ) : (
              <div className="empty-state-container">
                    <p>ไม่พบรายการที่ตรงตามเงื่อนไข</p>
                </div>
            )}

            {/* --- แสดง Modal เมื่อมี v ที่ถูกเลือก --- */}
            {selectedViolation && (
                <EvidenceModal violation={selectedViolation} onClose={() => setSelectedViolation(null)} />
            )}
        </div>
    );
};

export default ViolationsTable;