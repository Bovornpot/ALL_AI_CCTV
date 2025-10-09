// CameraConfig.tsx
import React, { useState, useEffect } from "react";
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

function buildRTSP(brand: string, ip: string): string {
  const user = "adminhq";
  const pass = "admin1%402";
  if (brand === "hikvision") {
    return `rtsp://${user}:${pass}@${ip}:554/Streaming/Channels/101`;
  } else if (brand === "dahua") {
    return `rtsp://${user}:${pass}@${ip}:554/cam/realmonitor?channel=1&subtype=0`;
  }
  return "";
}

interface CameraConfigProps {
  source: VideoSource;
  index: number;
  updateVideoSource: (index: number, field: keyof VideoSource, value: string) => void;
  branchId: string;
  /**
   * Optional: parent สามารถส่งฟังก์ชันนี้มาเพื่อสั่ง save config ไป backend ทันทีหลัง
   * เลือกแบรนด์ (sync กับ config.yaml)
   * ตัวอย่าง: autoSave={(idx) => saveConfigToBackend()}
   */
  autoSave?: (index: number) => void;
}

const CameraConfig = ({ source, index, updateVideoSource, branchId, autoSave }: CameraConfigProps) => {
  // brand="" => default "กรุณาเลือกรุ่นกล้อง"
  const [brand, setBrand] = useState<"" | "hikvision" | "dahua">("");
  const [mode, setMode] = useState<"" | "auto" | "manual">("");

  // หาก parent มี source.source_path และเป็น RTSP ของยี่ห้อใดอยู่แล้ว
  // สามารถ prefill brand ให้ตรงกับ source.source_path (optional)
  useEffect(() => {
    if (source.source_path) {
      if (source.source_path.includes("/cam/realmonitor")) {
        setBrand("dahua");
        setMode("auto");
      } else if (source.source_path.includes("Streaming/Channels")) {
        setBrand("hikvision");
        setMode("auto");
      } else {
        setMode("manual"); // Path จากวิดีโอในเครื่อง
      }
    } else {
      setMode(""); // ยังไม่ได้เลือก
      setBrand("");
    }
  }, []);

  // สร้าง RTSP อัตโนมัติเฉพาะเมื่อ mode=auto, branchId มีค่า, และ user เลือก brand
  useEffect(() => {
    if (mode !== "auto") return;
    if (!brand) {

      updateVideoSource(index, "source_path", "");
      return;
    }
    if (!branchId) return;
    const ip = buildIP(branchId);
    const rtsp = buildRTSP(brand, ip);
    updateVideoSource(index, "source_path", rtsp);
  }, [brand, branchId, mode]);

  const handleParkingZoneChange = (val: string) => {
    const filename = val.endsWith(".json") ? val : `${val}.json`;
    updateVideoSource(index, "parking_zone_file", filename);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* เลือกโหมด */}
      <div className="col-span-2">
        <label>โหมด Source</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "" | "auto" | "manual")}
          className="border p-2 rounded w-full"
        >
          <option value="">เลือกรูปแบบ</option>
          <option value="auto">RTSP อัตโนมัติจากรหัสร้าน</option>
          <option value="manual">Path จากวิดีโอในเครื่อง</option>
        </select>
      </div>

      {mode === "auto" && (
        <>
          {/* เลือกยี่ห้อ */}
          <div>
            <label>ยี่ห้อกล้อง</label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value as "" | "hikvision" | "dahua")}
              className="border p-2 rounded w-full"
            >
              <option value="">กรุณาเลือกรุ่นกล้อง</option>
              <option value="hikvision">Hikvision</option>
              <option value="dahua">Dahua</option>
            </select>
          </div>

          {/* RTSP อัตโนมัติ (read-only) */}
          <div className="col-span-2">
            <label>RTSP URL (อัตโนมัติ)</label>
            <input
              type="text"
              value={source.source_path || ""}
              readOnly
              placeholder="เลือกยี่ห้อและใส่รหัสร้านก่อน"
              className="border p-2 rounded w-full bg-gray-100"
            />
          </div>
        </>
      )}

      {mode === "manual" && (
        <div className="col-span-2">
          <label>Path วิดีโอ (Local/RTSP)</label>
          <input
            type="text"
            value={source.source_path}
            onChange={(e) => updateVideoSource(index, "source_path", e.target.value)}
            placeholder="C:\Users\xxx\Videos\test.mp4 หรือ rtsp://..."
            className="border p-2 rounded w-full"
          />
        </div>
      )}

      {/* Parking Zone */}
      <div className="col-span-2">
        <label>ไฟล์ Parking Zone</label>
        <input
          type="text"
          value={source.parking_zone_file}
          onChange={(e) => handleParkingZoneChange(e.target.value)}
          placeholder="เช่น zoneA"
          className="border p-2 rounded w-full"
        />
      </div>
    </div>
  );
};

export default CameraConfig;
