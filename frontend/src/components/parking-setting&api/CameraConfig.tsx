// CameraConfig.tsx
import React, { useState, useEffect, useRef } from "react";
import type { VideoSource } from "./ConfigManager";

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

function buildRTSP(brand: string, ip: string, channel: number): string {
  const user = "adminhq";
  const pass = "admin1%402";
  if (brand === "hikvision") {
    return `rtsp://${user}:${pass}@${ip}:554/Streaming/Channels/${channel}01`;
  } else if (brand === "dahua") {
    return `rtsp://${user}:${pass}@${ip}:554/cam/realmonitor?channel=${channel}&subtype=0`;
  }
  return "";
}

interface CameraConfigProps {
  source: VideoSource;
  index: number;
  updateVideoSource: (index: number, field: keyof VideoSource, value: string) => void;
  branchId: string;
  disabled?: boolean;
  overrideBranch?: string;
  overrideBranchId?: string;
  /**
   * Optional: parent สามารถส่งฟังก์ชันนี้มาเพื่อสั่ง save config ไป backend ทันทีหลัง
   * เลือกแบรนด์ (sync กับ config.yaml)
   * ตัวอย่าง: autoSave={(idx) => saveConfigToBackend()}
   */
  autoSave?: (index: number) => void;
}

// <-- Note: include overrideBranch and overrideBranchId in destructuring
const CameraConfig = ({ source, index, updateVideoSource, branchId, disabled, autoSave, overrideBranch, overrideBranchId }: CameraConfigProps) => {
  const [brand, setBrand] = useState<"" | "hikvision" | "dahua">("");
  const [mode, setMode] = useState<"" | "auto" | "manual">("");
  const [channel, setChannel] = useState<number>(1);
  
  // ใช้ค่า override ถ้ามี เพื่อ preview แบบ live
  const branchToUse = overrideBranch ?? source.branch ?? '';
  const branchIdToUse = overrideBranchId ?? source.branch_id ?? branchId ?? '';

  // ref เก็บค่า RTSP ล่าสุดที่เราเพิ่งส่งขึ้น parent เพื่อป้องกันการเรียกซ้ำ
  const lastRtspRef = useRef<string | null>(null);

  // Sync จาก parent.source.source_path -> local state (แต่ทำ guard ก่อน setState)
  useEffect(() => {
    const path = source.source_path ?? "";

    if (!path) {
      // ถ้าไม่มี source_path ให้รีเซ็ตเฉพาะถ้าค่าปัจจุบันต่างกับ default
      if (mode !== "" || brand !== "" || channel !== 1) {
        setMode("");
        setBrand("");
        setChannel(1);
      }
      return;
    }

    // ถ้าเป็น Dahua
    if (path.includes("/cam/realmonitor")) {
      const dahuaRegex = /channel=(\d+)/;
      const dahuaMatch = path.match(dahuaRegex);
      const parsedChannel = dahuaMatch && dahuaMatch[1] ? parseInt(dahuaMatch[1], 10) : 1;

      if (brand !== "dahua") setBrand("dahua");
      if (mode !== "auto") setMode("auto");
      if (channel !== parsedChannel) setChannel(parsedChannel);
      return;
    }

    // ถ้าเป็น Hikvision
    if (path.includes("Streaming/Channels")) {
      const hikvisionRegex = /Streaming\/Channels\/(\d+)/;
      const hikvisionMatch = path.match(hikvisionRegex);
      const raw = hikvisionMatch && hikvisionMatch[1] ? hikvisionMatch[1] : "1";

      // convert raw like "101" / "102" / "201" -> logical channel (1, 2, ...)
      let parsedLogicalChannel = 1;
      if (raw.length > 2 && (raw.endsWith("01") || raw.endsWith("02") || raw.endsWith("00"))) {
        // strip last two digits (stream type) then parse
        const prefix = raw.slice(0, raw.length - 2);
        parsedLogicalChannel = parseInt(prefix, 10) || 1;
      } else {
        parsedLogicalChannel = parseInt(raw, 10) || 1;
      }

      if (brand !== "hikvision") setBrand("hikvision");
      if (mode !== "auto") setMode("auto");
      // Guard: setChannel เฉพาะเมื่อค่าจริงๆ เปลี่ยน
      if (channel !== parsedLogicalChannel) setChannel(parsedLogicalChannel);
      return;
    }

    // กรณีอื่น ๆ ให้ถือเป็น manual path (เช่น local file หรือ RTSP ที่ไม่ได้มาตรฐานของเรา)
    if (mode !== "manual") setMode("manual");
    // brand อาจจะเก็บไว้เดิมหรือรีเซ็ตก็ได้ — เราเลือกไม่รีเซ็ต brand ให้ user ดูว่าเป็นอะไร
    // ตรวจเฉพาะ source.source_path เป็น dependency เพื่อให้ effect นี้วิ่งเฉพาะเมื่อ path เปลี่ยนจริง
  }, [source.source_path]); // safe dependency

  // สร้าง RTSP อัตโนมัติเฉพาะเมื่อ mode=auto, brand มีค่า และ branchIdToUse มีค่า
  useEffect(() => {
    if (mode !== "auto") return;
    if (!brand) return;
    if (!branchIdToUse) return; // <-- ใช้ branchIdToUse แทน branchId

    const ip = buildIP(branchIdToUse);
    if (!ip) return;

    const rtsp = buildRTSP(brand, ip, channel);
    // Guard: อย่าเรียก update ถ้าค่าเหมือนเดิม หรือเราเพิ่งส่งค่าเดียวกันไปแล้ว
    if (!rtsp) return;

    // guard 1: ถ้าเหมือนกับค่าใน parent อยู่แล้ว -> skip
    if (rtsp === (source.source_path ?? "")) {
      lastRtspRef.current = rtsp;
      return;
    }

    // guard 2: ถ้าเราเพิ่งส่งค่าเดียวกันแล้ว -> skip
    if (lastRtspRef.current && lastRtspRef.current === rtsp) {
      return;
    }

    // ส่งขึ้น parent
    try {
      updateVideoSource(index, "source_path", rtsp);
      lastRtspRef.current = rtsp;
      if (autoSave) autoSave(index);
    } catch (err) {
      console.warn("CameraConfig: failed to update source_path", err);
    }

    // intentionally NOT including updateVideoSource or autoSave in deps to avoid retrigger when parent re-creates functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, branchIdToUse, mode, channel, source.source_path, index]); // include branchIdToUse so override takes effect

  const handleParkingZoneChange = (val: string) => {
    const filename = val.endsWith(".json") ? val : `${val}.json`;
    updateVideoSource(index, "parking_zone_file", filename);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* ─────────────── คอลัมน์ซ้าย: โหมด Source ─────────────── */}
      <div className="col-span-1">
        <label className="block mb-1">โหมด Source</label>
        <select
          value={mode}
          onChange={(e) => !disabled && setMode(e.target.value as "" | "auto" | "manual")}
          className={`border p-2 rounded w-full ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          disabled={disabled}
        >
          <option value="">เลือกรูปแบบ</option>
          <option value="auto">RTSP อัตโนมัติจากรหัสร้าน</option>
          <option value="manual">Path จากวิดีโอในเครื่อง</option>
        </select>
      </div>

      {/* ─────────────── คอลัมน์ขวา ─────────────── */}
      <div className="col-span-1">
        {/* ========== โหมด AUTO ========== */}
        {mode === "auto" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {/* ยี่ห้อกล้อง */}
              <div>
                <label className="block mb-1">ยี่ห้อกล้อง</label>
                <select
                  value={brand}
                  onChange={(e) => !disabled && setBrand(e.target.value as "" | "hikvision" | "dahua")}
                  className={`border p-2 rounded w-full ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  disabled={disabled}
                >
                  <option value="">กรุณาเลือกรุ่นกล้อง</option>
                  <option value="hikvision">Hikvision</option>
                  <option value="dahua">Dahua</option>
                </select>
              </div>

              {/* Channel */}
              <div>
                <label className="block mb-1">Channel</label>
                <select
                  value={channel}
                  onChange={(e) => !disabled && setChannel(Number(e.target.value))}
                  className={`border p-2 rounded w-full ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  disabled={disabled}
                >
                  {[1, 2, 3, 4, 5].map(ch => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* RTSP URL (เต็มความกว้างเหมือนไฟล์ Parking Zone) */}
            {/* <div className="col-span-2 mt-3">
              <label className="block mb-1">RTSP URL (อัตโนมัติ)</label>
              <input
                type="text"
                value={source.source_path || ""}
                readOnly
                placeholder="เลือกยี่ห้อและใส่รหัสร้านก่อน"
                className={`border p-2 rounded w-full ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                disabled={disabled}
              />
            </div> */}
          </>
        )}

        {/* ========== โหมด MANUAL ========== */}
        {mode === "manual" && (
          <div>
            <label className="block mb-1">Path วิดีโอ (Local/RTSP)</label>
            <input
              type="text"
              value={source.source_path}
              onChange={(e) => updateVideoSource(index, "source_path", e.target.value)}
              placeholder="C:\\Users\\xxx\\Videos\\test.mp4 หรือ rtsp://..."
              className={`border p-2 rounded w-full ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              disabled={disabled}
            />
          </div>
        )}
      </div>

        
      {/* ─────────────── RTSP URL (เฉพาะตอนเลือกโหมด AUTO) ─────────────── */}
      {mode === "auto" && (
        <div className="col-span-2 mt-3">
          <label className="block mb-1">RTSP URL (อัตโนมัติ)</label>
          <input
            type="text"
            value={source.source_path || ""}
            readOnly
            placeholder="เลือกยี่ห้อและใส่รหัสร้านก่อน"
            className={`border p-2 rounded w-full ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            disabled={disabled}
          />
        </div>
      )}

      {/* ─────────────── แถวล่าง: Parking Zone ─────────────── */}
      {/* <div className="col-span-2">
        <label className="block mb-1 mt-3">ไฟล์ Parking Zone</label>
        <input
          type="text"
          value={source.parking_zone_file}
          onChange={(e) => handleParkingZoneChange(e.target.value)}
          placeholder="เช่น zoneA"
          className={`border p-2 rounded w-full ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          disabled={disabled}
        />
      </div> */}
    </div>
  );
};

export default CameraConfig;
