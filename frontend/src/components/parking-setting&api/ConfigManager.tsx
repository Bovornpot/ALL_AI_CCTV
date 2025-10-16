// src/components/ConfigManager.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {Settings,Camera,Monitor,Clock,Plus,Trash2,Save,AlertTriangle,Cpu,Edit2,Crop} from 'lucide-react';
import { useNavigate } from 'react-router-dom'; 
import AILogConsole from "./AILogConsole";
import CameraConfig from "./CameraConfig"; 
import VideoPanel from "./VideoPanel";
const API_BASE_URL = process.env.REACT_APP_API_URL;
// ใช้ API_BASE_URL ถ้ามี ถ้าไม่มี fallback ไปที่ URL ปัจจุบัน
const BASE = API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:${window.location.port}`;

// === การกำหนดประเภท (Type Definitions) ===
// กำหนดโครงสร้างสำหรับ Video Source แต่ละตัว
export interface VideoSource {
  _id?: string;   // (stable id สำหรับ UI)
  name: string;
  branch: string;
  source_path: string;
  parking_zone_file: string;
  branch_id: string;
  camera_id: string;
}
interface BranchEditBufferItem {
  displayName: string;
  branch_id: string;
  mainCameraName: string;
}
interface DebugSettings {
  enabled: boolean
  mock_warning_minutes: number
  mock_violation_minutes: number
}
interface PerformanceSettings {
  target_inference_width: number
  frames_to_skip: number
  draw_bounding_box: boolean
}

// แก้ไขให้ตรงกับ Backend
interface Config {
  model_path: string;
  yolo_model: string;
  img_size: number[]; // ต้องเป็น Array ของตัวเลข
  conf_threshold: number; 
  iou_threshold: number; 
  reid_model: string;
  boxmot_config_path: string;
  detection_confidence_threshold: number; // ต้องเป็นตัวเลข
  car_class_id: number[]; // ต้องเป็น Array ของตัวเลข
  tracking_method: string;
  per_class_tracking: boolean;
  debug_settings: DebugSettings;
  parking_time_limit_minutes: number;
  parking_time_threshold_seconds: number;
  grace_period_frames_exit: number;
  parked_car_timeout_seconds: number;
  movement_threshold_px: number;
  movement_frame_window: number;
  output_dir: string;
  device: string;
  half_precision: boolean;
  api_key: string;
  display_combined_max_width: number;
  display_combined_max_height: number;
  queue_max_size: number;
  save_video: boolean;
  save_mot_results: boolean;
  enable_brightness_adjustment: boolean;
  brightness_method: string;
  video_sources: VideoSource[];
  performance_settings: PerformanceSettings;
}

// กำหนดโครงสร้างสำหรับ Saved Configs
interface SavedConfig {
  name: string;
  config: Config;
  timestamp: string;
}

// กำหนด props สำหรับแต่ละ Component ย่อย
interface TabButtonProps {
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  onClick: () => void;
}

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string | number) => void;
  type?: "text" | "number";
  className?: string;
  disabled?: boolean;
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

interface CheckboxFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}


// === Component ย่อยที่ปรับแก้ Props แล้ว ===
const TabButton: React.FC<TabButtonProps> = ({ label, icon: Icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
      isActive
        ? 'bg-blue-600 text-white shadow-lg'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
    }`}
  >
    <Icon size={18} />
    <span>{label}</span>
  </button>
);

const InputField: React.FC<InputFieldProps> = ({ label, value, onChange, type = "text", className = "", disabled = false }) => (
  <div className={`mb-4 ${className}`}>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <input
      type={type}
      value={value}
      // เพิ่มการตรวจสอบและแปลงค่าสำหรับ 'number' และ 'text'
      onChange={(e) => {
        const inputValue = e.target.value;
        if (type === 'number') {
          onChange(parseFloat(inputValue) || 0); // แปลงเป็นตัวเลข
        } else {
          onChange(inputValue); // คงเป็น String
        }
      }}
      disabled={disabled}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>
);

const SelectField: React.FC<SelectFieldProps> = ({ label, value, onChange, options, className = "" }) => (
  <div className={`mb-4 ${className}`}>
    <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const CheckboxField: React.FC<CheckboxFieldProps> = ({ label, value, onChange, className = "" }) => (
  <div className={`mb-4 ${className}`}>
    <label className="flex items-center space-x-2 cursor-pointer">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  </div>
);

// --- Branch grouping type + helper (วางที่ระดับบนของไฟล์ ก่อนฟังก์ชัน ConfigManager) ---
type BranchGroup = {
  key: string;
  displayName: string;
  branch_id: string;
  sources: VideoSource[];
};

const groupVideoSources = (sources: VideoSource[]): BranchGroup[] => {
  const groups = new Map<string, VideoSource[]>();
  sources.forEach((src) => {
    const key = src.branch_id?.trim() || src.branch?.trim() || `__ungrouped__`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(src);
  });
  return Array.from(groups.entries()).map(([key, s]) => ({
    key,
    displayName: s[0].branch || (key === '__ungrouped__' ? 'สาขา (ไม่ระบุ)' : s[0].branch),
    branch_id: s[0].branch_id || '',
    sources: s,
  }));
};

// helper สร้าง id แบบสั้นๆ แก้ปัญหา key camera_id
const makeId = () => Math.random().toString(36).slice(2, 9);

// === Component หลัก ===
const ConfigManager: React.FC = () => {
  const navigate = useNavigate(); // ใช้ hook useNavigate
  // useState สำหรับเก็บค่า config
  const [config, setConfig] = useState<Config | null>(null); // ตั้งค่าเริ่มต้นเป็น null เพื่อรอข้อมูลจาก backend
  const [activeTab, setActiveTab] = useState<string>('cameras');
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewEnabledMap, setViewEnabledMap] = useState<Record<string, boolean>>({});
  // const [aiRunning, setAiRunning] = useState(false);
  const [cameraEditBuffer, setCameraEditBuffer] = useState<Record<string, VideoSource>>({});
  
  // edit map now stores both branch and camera keys. We'll prefix keys with 'branch:' or 'camera:'
  const [editEnabledMap, setEditEnabledMap] = useState<Record<string, boolean>>({});

  const [branchEditBuffer, setBranchEditBuffer] = useState<Record<string, BranchEditBufferItem>>({});

  // ดึงค่า config จาก Backend เมื่อ Component ถูกโหลดครั้งแรก
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // เปลี่ยน URL ตรงนี้ให้เป็นแบบ Relative เพื่อให้ Vite Proxy ทำงาน
        const response = await fetch(`${API_BASE_URL}/api/config`);
        // const response = await fetch('/api/config');
        const backendConfig: Config = await response.json();

        // เติม _id ให้ทุก video_source ถ้ายังไม่มี
        backendConfig.video_sources = backendConfig.video_sources.map(v => ({
          ...v,
          _id: (v as any)._id ?? makeId()
        }));
        
        // เพิ่มบรรทัดนี้เพื่อกำหนดค่าเริ่มต้นสำหรับ yolo_model
        if (!backendConfig.yolo_model) {
          backendConfig.yolo_model = 'yolo12n.pt'; // กำหนดค่าเริ่มต้นเป็น yolo12n.pt
        }
        
        setConfig(backendConfig);
      } catch (err: any) {
        console.error("Error fetching config:", err);
        setError("ไม่สามารถเชื่อมต่อกับ Backend ได้ โปรดตรวจสอบว่า FastAPI Server ทำงานอยู่");
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();

    const saved = localStorage.getItem('ai-configs');
      if (saved) {
        setSavedConfigs(JSON.parse(saved));
      }
  }, []);

  async function createParkingZoneFile(payload: VideoSource) {
    try {
      const response = await fetch(`${BASE}/api/config/create_camera_file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Failed to create parking zone file");

      const data = await response.json();
      console.log("✅ Created parking zone file:", data.path || data.filename);
      return data.path || data.filename;
    } catch (error) {
      console.error("❌ Error creating parking zone file:", error);
      return null;
    }
  }

  async function deleteParkingZoneFile(filePath: string) {
    try {
      const encodedPath = encodeURIComponent(filePath); // สำคัญ
      const response = await fetch(`${BASE}/api/config/delete_camera_file/${encodedPath}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete parking zone file: ${text}`);
      }

      console.log("🗑️ Deleted parking zone file:", filePath);
      // คืนค่า true เพื่อให้ caller ตัดสินใจอัปเดต state
      return true;
    } catch (error) {
      console.error("❌ Error deleting parking zone file:", error);
      // คืน false (caller จะยังลบ entry จาก config ต่อหรือ handle ตามนโยบาย)
      return false;
    }
  }

  const toggleViewForCamera = (cameraKey: string) => {
    setViewEnabledMap(prev => ({ ...prev, [cameraKey]: !prev[cameraKey] }));
  };


  const updateConfig = (path: string, value: any) => {
    setConfig(prev => {
      if (!prev) return prev;
      const newConfig = { ...prev };
      const keys = path.split('.');
      let current: any = newConfig;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      // ตรวจสอบและแปลงค่าสำหรับ List
      if (path === 'car_class_id' || path === 'img_size') {
        // Assume value is a string like "0,1,2"
        const numbers = (value as string).split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        current[keys[keys.length - 1]] = numbers;
      } else {
        current[keys[keys.length - 1]] = value;
      }

      return newConfig;
    });
  };

  const addBranch = async () => {
    if (!config) return;
    const index = (config.video_sources?.length ?? 0) + 1;
    const cameraName = `camera_${index}`;
    const payload: VideoSource = { _id: makeId(), name: cameraName, branch: '', source_path: '', parking_zone_file: '', branch_id: '', camera_id: '' };
    try {
      const roi = await createParkingZoneFile(payload);
      payload.parking_zone_file = roi ?? payload.parking_zone_file;
      setConfig(prev => {
        if (!prev) return prev;
        return { ...prev, video_sources: [...prev.video_sources, payload] } as Config;
      });
      // เปิดโหมดแก้ไขสาขาอัตโนมัติ (ใช้ branch key ชั่วคราว)
      const newBranchKey = payload.branch_id || payload.branch || '__ungrouped__';
      setTimeout(() => {
        setEditEnabledMap(prev => ({ ...prev, [`branch:${newBranchKey}`]: true }));
        const el = document.querySelector<HTMLInputElement>(`#camera-${cameraName}-branch`);
        el?.focus();
      }, 80);
    } catch (err) { console.error(err); alert('ไม่สามารถสร้างสาขาใหม่ได้'); }
  };

  const addCameraToBranch = async (branchKey: string) => {
    if (!config) return;
    const index = (config.video_sources?.length ?? 0) + 1;
    const cameraName = `camera_${index}`;
    const groups = groupVideoSources(config.video_sources);
    const target = groups.find(g => g.key === branchKey);
    const payload: VideoSource = { _id: makeId(), name: cameraName, branch: target?.displayName || '', source_path: '', parking_zone_file: '', branch_id: target?.branch_id || '', camera_id: '' };
    try {
      const roi = await createParkingZoneFile(payload);
      payload.parking_zone_file = roi ?? payload.parking_zone_file;
      setConfig(prev => {
        if (!prev) return prev;
        return { ...prev, video_sources: [...prev.video_sources, payload] } as Config;
      });
      setTimeout(() => { const el = document.querySelector<HTMLInputElement>(`#camera-${cameraName}-camera_id`); el?.focus(); }, 80);
    } catch (err) { console.error(err); alert('ไม่สามารถเพิ่มกล้องได้'); }
  };

  // helper สร้าง key ให้สอดคล้องกัน(ใช้ทุกที่)
  const getCameraKey = (s: VideoSource | string) => {
    // ถ้าเป็น VideoSource ให้คืน _id first, else ให้ใช้ string (ถ้าเรียกตรง ๆ)
    if (typeof s === 'string') return s;
    return s._id ?? s.camera_id ?? s.name;
  };

  // เริ่มแก้ไขกล้อง: เก็บ snapshot ลง buffer แล้วตั้ง flag
  const startEditForCamera = (cameraKey: string, index: number) => {
    // เก็บ snapshot
    const src = config?.video_sources[index];
    if (!src) return;
    const key = `camera:${cameraKey}`;
    setCameraEditBuffer(prev => ({ ...prev, [cameraKey]: { ...src } }));
    setEditEnabledMap(prev => ({ ...prev, [key]: true }));
  };

  // บันทึกการแก้ไขสำหรับกล้องเดียว
  const saveCameraEdits = async (cameraKey: string) => {
    const key = `camera:${cameraKey}`;
    // ปิด flag และลบ buffer
    setEditEnabledMap(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
    setCameraEditBuffer(prev => { const copy = { ...prev }; delete copy[cameraKey]; return copy; });
    // บันทึกทั้ง config ไป backend
    await saveConfigToBackend(true);
  };

  // ยกเลิกการแก้ไข: คืนค่า snapshot กลับไปยัง config (ไม่บันทึก)
  const cancelEditForCamera = (cameraKey: string, index?: number) => {
    const snap = cameraEditBuffer[cameraKey];
    if (!snap) {
      // ไม่มี snapshot -> แค่ปิด flag
      setEditEnabledMap(prev => { const copy = { ...prev }; delete copy[`camera:${cameraKey}`]; return copy; });
      return;
    }
    // คืนค่าในตำแหน่ง index (ถ้าไม่มี index จะค้นหาโดย _id)
    setConfig(prev => {
      if (!prev) return prev;
      const newSources = prev.video_sources.map((s) => (getCameraKey(s) === cameraKey ? { ...snap } : s));
      return { ...prev, video_sources: newSources } as Config;
    });
    // ทำความสะอาด flag และ buffer
    setEditEnabledMap(prev => { const copy = { ...prev }; delete copy[`camera:${cameraKey}`]; return copy; });
    setCameraEditBuffer(prev => { const copy = { ...prev }; delete copy[cameraKey]; return copy; });
  };

  // ---- ฟังก์ชันช่วยจัดการ edit buffer และ delete branch ----
  const startEditBranch = (branchKey: string) => {
    if (!config) return;
    const groups = groupVideoSources(config.video_sources);
    const g = groups.find(gr => gr.key === branchKey);
    if (!g) return;

    // set buffer (เดิม)
    setBranchEditBuffer(prev => ({ 
      ...prev, 
      [branchKey]: {
        displayName: g.displayName || '',
        branch_id: g.branch_id || '',
        mainCameraName: g.sources[0]?.name || ''
      }
    }));

    // set branch edit flag (เฉพาะ branch เท่านั้น)
    setEditEnabledMap(prev => ({ ...prev, [`branch:${branchKey}`]: true }));

    // **NOTE:** ไม่ตั้ง flag ให้ camera:* ที่นี่แล้ว
  };

  const saveBranchEdits = async (branchKey: string) => {
    if (!config) return;
    const buffer = branchEditBuffer[branchKey];
    if (!buffer) {
      // ถ้าไม่มี buffer ให้ปิดโหมดแก้ไข
      setEditEnabledMap(prev => ({ ...prev, [`branch:${branchKey}`]: false }));
      return;
    }

    // หา sources ของกลุ่มนี้ (ปัจจุบัน)
    const groups = groupVideoSources(config.video_sources);
    const g = groups.find(gr => gr.key === branchKey);
    if (!g) {
      // ไม่พบกลุ่ม -> ปิด edit
      setEditEnabledMap(prev => ({ ...prev, [`branch:${branchKey}`]: false }));
      setBranchEditBuffer(prev => { const copy = { ...prev }; delete copy[branchKey]; return copy; });
      return;
    }

    // --- สร้าง newConfig ก่อน แล้วอัปเดต state และส่งไป backend โดยตรง ---
    const newSources = config.video_sources.map(s => {
      if (g.sources.find(gs => gs._id === s._id)) {
        return { ...s, branch: buffer.displayName, branch_id: buffer.branch_id };
      }
      return s;
    });
    const newConfig: Config = { ...config, video_sources: newSources };

    // อัปเดต state (synchronous call)
    setConfig(newConfig);

    // ลบ buffer ของ key เดิม
    setBranchEditBuffer(prev => { const copy = { ...prev }; delete copy[branchKey]; return copy; });

    // ทำความสะอาด edit map: ปิด branch flag และลบ flag ของ camera:* ทั้งหมดในกลุ่มนี้ (ถ้ามี)
    setEditEnabledMap(prev => {
      const copy = { ...prev };
      delete copy[`branch:${branchKey}`];
      g.sources.forEach(s => {
        const cameraKey = s._id ?? s.camera_id ?? s.name;
        delete copy[`camera:${cameraKey}`];
      });
      return copy;
    });

    // บันทึกไป backend โดยส่ง newConfig (แก้ปัญหา race ของ setState)
    await saveConfigToBackend(true, newConfig);
  };

  const cancelEditBranch = (branchKey: string) => {
    // ยกเลิกเฉพาะ local buffer, ไม่เปลี่ยน video_sources
    setBranchEditBuffer(prev => { const copy = { ...prev }; delete copy[branchKey]; return copy; });

    // ปิด branch flag และลบ camera flags ในกลุ่ม (ถ้ามี)
    setEditEnabledMap(prev => {
      const copy = { ...prev };
      delete copy[`branch:${branchKey}`];

      // หากลุ่มจาก current config เพื่อรู้ว่าต้องลบ camera ใด
      const groups = config ? groupVideoSources(config.video_sources) : [];
      const g = groups.find(gr => gr.key === branchKey);
      if (g) {
        g.sources.forEach(s => {
          const cameraKey = s._id ?? s.camera_id ?? s.name;
          delete copy[`camera:${cameraKey}`];
        });
      }
      return copy;
    });
  };


  // ลบสาขา: ลบทุก video_sources ในกลุ่มเดียวกัน
  const removeBranch = async (branchKey: string) => {
    if (!config) return;
    const groups = groupVideoSources(config.video_sources);
    const g = groups.find(gr => gr.key === branchKey);
    if (!g) return;
    const confirmed = window.confirm(`⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบสาขา "${g.displayName}" พร้อมกล้องทั้งหมด ${g.sources.length} ตัว?`);
    if (!confirmed) return;

    // ลบไฟล์ parking_zone สำหรับแต่ละกล้อง (best-effort)
    for (const src of g.sources) {
      try { if (src.parking_zone_file) await deleteParkingZoneFile(src.parking_zone_file); } catch(e){ console.warn('ลบ ROI ล้มเหลว', e); }
    }

    // สร้าง updatedConfig ก่อนแล้ว setState
    const newSources = config.video_sources.filter(s => !g.sources.find(gs => gs._id === s._id));
    const updatedConfig: Config = { ...config, video_sources: newSources };
    setConfig(updatedConfig);

    // ทำความสะอาด edit/view map ของกล้องในกลุ่ม
    setEditEnabledMap(prev => {
      const copy = { ...prev };
      g.sources.forEach(s => delete copy[`camera:${s._id ?? s.camera_id ?? s.name}`]);
      delete copy[`branch:${branchKey}`];
      return copy;
    });
    setViewEnabledMap(prev => {
      const copy = { ...prev };
      g.sources.forEach(s => { delete copy[s._id ?? s.camera_id ?? s.name]; });
      return copy;
    });

    // และบันทึกไป backend โดยส่ง updatedConfig
    await saveConfigToBackend(true, updatedConfig);
  };


  const addVideoSource = async () => {
    if (!config) return;

    // สร้างชื่อกล้องใหม่
    const index = (config.video_sources?.length ?? 0) + 1;
    const cameraName = `camera_${index}`;

    // เตรียม payload ให้ครบทุก field
    const payload: VideoSource = {
      _id: makeId(),
      name: cameraName,
      branch: "",            // user จะกรอกต่อ
      source_path: "",       // user จะกรอกต่อ
      parking_zone_file: "", // backend จะสร้างไฟล์
      branch_id: "",         // user จะกรอกต่อ
      camera_id: ""          // user จะกรอกต่อ
    };

    try {
      // เรียก backend สร้าง ROI file
      const createRes = await fetch(`${BASE}/api/config/create_camera_file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload) // ✅ ส่ง payload ครบ
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Failed to create zone file: ${errText}`);
      }

      const createData = await createRes.json();
      const roiFile = createData.path || createData.filename || createData.name;
      if (!roiFile) console.warn("Backend didn't return ROI filename, using default");

      // เติมชื่อไฟล์ ROI ใน source
      payload.parking_zone_file = roiFile ?? `AI/roi/${cameraName}_roi.json`;

      // อัปเดต state
      setConfig(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          video_sources: [...prev.video_sources, payload]
        } as Config;
      });

      // ✅ focus ไปที่ input ของ branch/camera_id ถัดไป (ถ้ามีฟอร์ม)
      setTimeout(() => {
        const firstInput = document.querySelector<HTMLInputElement>(`#camera-${cameraName}-branch`);
        firstInput?.focus();
      }, 100);

      console.log("✅ Camera & ROI created:", payload);
    } catch (error) {
      console.error("❌ Error creating camera file:", error);
      alert(`ไม่สามารถสร้างไฟล์ parking zone ได้: ${error}`);
    }
  };

  
  const removeVideoSource = async (index: number, cameraKey?: string) => {
    if (!config) return;
    const toRemove = config.video_sources[index];
    const fileToDelete = toRemove?.parking_zone_file ?? `parking_zone_${toRemove?.name || index + 1}.json`;
    try { await deleteParkingZoneFile(fileToDelete); } catch (err) { console.warn('ลบไฟล์ parking zone อาจล้มเหลว:', err); }
    const updated: Config = { ...config, video_sources: config.video_sources.filter((_, i) => i !== index) };
    setConfig(updated);
    if (cameraKey) {
      const camFull = `camera:${cameraKey}`;
      setEditEnabledMap(prev => { const copy = { ...prev }; delete copy[camFull]; return copy; });
      setViewEnabledMap(prev => { const copy = { ...prev }; delete copy[cameraKey]; return copy; });
    }
    await saveConfigToBackend(true, updated);
  };


  const updateVideoSource = useCallback(
    (index: number, field: keyof VideoSource, value: string) => {
      setConfig(prev => {
        if (!prev) return prev;
        const newSources = prev.video_sources.map((s, i) =>
          i === index ? { ...s, [field]: value } : s
        );
        return { ...prev, video_sources: newSources } as Config;
      });
    },
    [] // ✅ dependency array ว่าง เพราะ setConfig มาจาก useState (ไม่เปลี่ยน)
  );
  
  const generateYAML = (): string => {
    if (!config) return "";
    let yaml = `# config.yaml

# YOLO Model Settings
model_path: ${config.model_path}
yolo_model: "${config.yolo_model}"
img_size: [${config.img_size.join(', ')}]
conf_threshold: ${config.conf_threshold}
iou_threshold: ${config.iou_threshold}

# Re-ID Model Settings
reid_model: "${config.reid_model}"
boxmot_config_path: ${config.boxmot_config_path}
detection_confidence_threshold: ${config.detection_confidence_threshold}
car_class_id: [${config.car_class_id.join(', ')}]

# Tracking Method
tracking_method: "${config.tracking_method}"
per_class_tracking: ${config.per_class_tracking}

# Debug Settings
debug_settings:
  enabled: ${config.debug_settings.enabled}
  mock_warning_minutes: ${config.debug_settings.mock_warning_minutes}
  mock_violation_minutes: ${config.debug_settings.mock_violation_minutes}

# Parking Thresholds
parking_time_limit_minutes: ${config.parking_time_limit_minutes}
parking_time_threshold_seconds: ${config.parking_time_threshold_seconds}
grace_period_frames_exit: ${config.grace_period_frames_exit}
parked_car_timeout_seconds: ${config.parked_car_timeout_seconds}

# Movement Detection
movement_threshold_px: ${config.movement_threshold_px}
movement_frame_window: ${config.movement_frame_window}

# Output Settings
output_dir: "${config.output_dir}"

# Hardware Settings
device: "${config.device}"
half_precision: ${config.half_precision}

# API Key
api_key: "${config.api_key}"

# Display Settings
display_combined_max_width: ${config.display_combined_max_width}
display_combined_max_height: ${config.display_combined_max_height}

# Queue Settings
queue_max_size: ${config.queue_max_size}

# Save Settings
save_video: ${config.save_video}
save_mot_results: ${config.save_mot_results}

# Brightness Adjustment
enable_brightness_adjustment: ${config.enable_brightness_adjustment}
brightness_method: ${config.brightness_method}

# Video Sources
video_sources:
${config.video_sources.map(source => `  - name: "${source.name}"
    branch: "${source.branch}"
    source_path: "${source.source_path}"
    parking_zone_file: "${source.parking_zone_file}"
    branch_id: "${source.branch_id}"
    camera_id: "${source.camera_id}"`).join('\n')}

# Performance Settings
performance_settings:
  target_inference_width: ${config.performance_settings.target_inference_width}
  frames_to_skip: ${config.performance_settings.frames_to_skip}
  draw_bounding_box: ${config.performance_settings.draw_bounding_box}
`;

    return yaml;
  };

  const saveConfigToBackend = async (showAlert = true, configToSave?: Config | null) => {
    const payload = configToSave ?? config;
    if (!payload) return; // <-- ตรวจ payload

    console.log("💾 [saveConfigToBackend] Called with payload:", payload);
    console.log("📊 จำนวน video_sources ที่จะบันทึก:", payload.video_sources?.length);

    try {
      const response = await fetch(`${API_BASE_URL}/api/config`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // ถ้าต้องการ ลองอ่าน error body
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.detail ? JSON.stringify(errorData.detail, null, 2) : `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }
      console.log("✅ [saveConfigToBackend] Config saved successfully.");

      if (showAlert) {
        alert('✅ การตั้งค่าถูกบันทึกที่ Backend เรียบร้อยแล้ว!');
      }
    } catch (err) {
      console.error('Failed to save config', err);
      if (showAlert) {
        alert(`เกิดข้อผิดพลาดในการบันทึก: ${err}`);
      }
    }
  };

  const loadConfig = (savedConfig: SavedConfig) => {
    const cfg = {
      ...savedConfig.config,
      video_sources: savedConfig.config.video_sources.map(v => ({ ...v, _id: (v as any)._id ?? makeId() }))
    };
    setConfig(cfg);
  };

  const handleManageRoi = (cameraId: string) => {
    // ตรวจสอบว่า cameraId มีค่าก่อนที่จะ navigate
    if (cameraId) {
      navigate(`/roi/${cameraId}`); // นำทางไปยังหน้าวาด ROI
    } else {
      alert('ไม่พบ Camera ID สำหรับกล้องนี้');
    }
  };

  // เพิ่มส่วนแสดงผลเมื่อโหลดอยู่หรือเกิดข้อผิดพลาด
  if (loading) {
      return <div className="text-center p-16">กำลังโหลดการตั้งค่า...</div>;
  }

  if (error) {
      return <div className="text-center p-16 text-red-600">{error}</div>;
  }

  // ตรวจสอบว่า config ไม่ใช่ null ก่อนแสดงผล
  if (!config) {
    return null;
  }

  const groups: BranchGroup[] = groupVideoSources(config.video_sources);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            AI Car Parking Setting
          </h1>
          <p className="text-xl text-gray-600">ตั้งค่าระบบตรวจสอบที่จอดรถอัจฉริยะ</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <div className="container mx-auto p-6 space-y-6">
            {/* ส่วนอื่น ๆ ของ ConfigManager */}
            <AILogConsole />
          </div>
        </div>

        {/* Saved Configurations */}
        {savedConfigs.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">การตั้งค่าที่บันทึกไว้</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedConfigs.map((savedConfig, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800">{savedConfig.name}</h4>
                  <p className="text-sm text-gray-500 mb-3">
                    {new Date(savedConfig.timestamp).toLocaleString('th-TH')}
                  </p>
                  <button
                    onClick={() => loadConfig(savedConfig)}
                    className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                  >
                    โหลดการตั้งค่า
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 bg-white rounded-xl shadow-lg p-4">
          <TabButton
            label="กล้อง"
            icon={Camera}
            isActive={activeTab === 'cameras'}
            onClick={() => setActiveTab('cameras')}
          />
          <TabButton
            label="การจอดรถ"
            icon={Clock}
            isActive={activeTab === 'parking'}
            onClick={() => setActiveTab('parking')}
          />
          <TabButton
            label="ประสิทธิภาพ"
            icon={Cpu}
            isActive={activeTab === 'performance'}
            onClick={() => setActiveTab('performance')}
          />
          <button
            onClick={() => saveConfigToBackend(true)}
            className="ml-auto flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors shadow-lg"
          >
            <Save size={20} />
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {activeTab === 'model' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">การตั้งค่าโมเดล AI</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectField
                  label="โมเดล YOLO"
                  value={config.yolo_model}
                  onChange={(value) => updateConfig('yolo_model', value)}
                  options={[
                    { value: 'yolo12n.pt', label: 'YOLO12 Nano (เร็วที่สุด แต่ไม่แม่นยำมาก)' },
                    { value: 'yolo12s.pt', label: 'YOLO12 Small (เร็วเล็กน้อย ความแม่นยำน้อย)' },
                    { value: 'yolo12m.pt', label: 'YOLO12 Medium (ระดับกลาง)' },
                    { value: 'yolo12l.pt', label: 'YOLO12 Large (ช้า แต่ความแม่ยำสูง)' }
                  ]}
                />

                <SelectField
                  label="อุปกรณ์ที่ใช้"
                  value={config.device}
                  onChange={(value) => updateConfig('device', value)}
                  options={[
                    { value: 'cpu', label: 'CPU' },
                    { value: 'cuda', label: 'GPU (CUDA)' }
                  ]}
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">การตั้งค่าดีบัก</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CheckboxField
                    label="เปิดโหมดดีบัก (จำลองการทำงานที่เร็วขึ้น)"
                    value={config.debug_settings.enabled}
                    onChange={(value) => updateConfig('debug_settings.enabled', value)}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cameras' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">การตั้งค่ากล้อง</h2>
              </div>

              {(() => {
                const palettes = [{
                  leftBorder: 'border-l-4 border-cyan-500',
                  headerBg: 'bg-cyan-50',
                  headerText: 'text-cyan-800',
                  badge: 'bg-cyan-500'
                }];

                return groups.map((group: BranchGroup, idx: number) => {
                  const palette = palettes[idx % palettes.length];
                  const branchEditKey = `branch:${group.key}`;
                  const isBranchEditing = !!editEnabledMap[branchEditKey];

                  return (
                    <div key={group.key} className={`${palette.leftBorder} mb-4 rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm border-l-[#06b6d4]`}>
                      {/* branch header */}
                      <div className={`${palette.headerBg} px-6 py-3 flex items-center justify-between`}>
                        <div className="flex items-center">
                          <span className={`${palette.badge} inline-block w-3 h-3 rounded-full mr-3`} />
                          <div>
                            <div className={`font-semibold ${palette.headerText}`}>{group.displayName}</div>
                            <div className="text-xs text-gray-500">Branch ID: {group.branch_id}</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {!isBranchEditing ? (
                            <>
                              <button
                                onClick={() => startEditBranch(group.key)}
                                className="flex items-center px-3 py-1 rounded-md text-sm transition-colors bg-yellow-500 text-white hover:bg-yellow-600"
                              >
                                <Edit2 size={16} className="mr-1" /> แก้ไขสาขา
                              </button>

                              <button
                                onClick={() => addCameraToBranch(group.key)}
                                className="flex items-center px-3 py-1 bg-blue-700 text-white rounded-md hover:bg-blue-800 text-sm"
                              >
                                <Plus size={14} className="mr-1" /> เพิ่มกล้อง
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => saveBranchEdits(group.key)}
                                className="flex items-center px-3 py-1 rounded-md text-sm transition-colors bg-green-600 text-white hover:bg-green-700"
                              >
                                <Save size={16} className="mr-1" /> บันทึกสาขา
                              </button>

                              <button
                                onClick={() => cancelEditBranch(group.key)}
                                className="flex items-center px-3 py-1 rounded-md text-sm bg-gray-200 hover:bg-gray-300"
                              >
                                ยกเลิกแก้ไข
                              </button>

                              <button
                                onClick={() => removeBranch(group.key)}
                                className="flex items-center px-3 py-1 text-white bg-red-600 rounded-md hover:bg-red-700 text-sm"
                                title="ลบสาขา"
                              >
                                <Trash2 size={16} className="mr-1" /> ลบสาขา
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* branch-level fields (propagate to all in group) */}
                      <div className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                          <InputField
                            label="ชื่อสาขา"
                            value={ isBranchEditing ? (branchEditBuffer[group.key]?.displayName ?? '') : group.displayName }
                            onChange={(v) => {
                              if (isBranchEditing) {
                                setBranchEditBuffer(prev => ({
                                  ...prev,
                                  [group.key]: {
                                    ...(prev[group.key] ?? { displayName: group.displayName, branch_id: group.branch_id, mainCameraName: group.sources[0]?.name ?? '' }),
                                    displayName: String(v)
                                  }
                                }));
                              } else {
                                return;
                              }
                            }}
                            disabled={!isBranchEditing}
                          />

                          <InputField
                            label="Branch ID"
                            value={ isBranchEditing ? (branchEditBuffer[group.key]?.branch_id ?? '') : group.branch_id }
                            onChange={(v) => {
                              if (isBranchEditing) {
                                setBranchEditBuffer(prev => ({
                                  ...prev,
                                  [group.key]: {
                                    ...(prev[group.key] ?? { displayName: group.displayName, branch_id: group.branch_id, mainCameraName: group.sources[0]?.name ?? '' }),
                                    branch_id: String(v)
                                  }
                                }));
                              } else {
                                return;
                              }
                            }}
                            disabled={!isBranchEditing}
                          />
                        </div>

                        {/* inner: cameras */}
                        <div className="space-y-4">
                          {group.sources.map((source: VideoSource) => {
                            const realIndex = config.video_sources.findIndex(s => s._id === source._id);
                            const cameraKey = getCameraKey(source);
                            const camEditKey = `camera:${cameraKey}`;
                            const isCamEditing = !!editEnabledMap[camEditKey];
                            const streamId = source.camera_id || source.name;

                            // effective (live) branch values while branch is being edited
                            const effectiveBranch = isBranchEditing
                              ? (branchEditBuffer[group.key]?.displayName ?? group.displayName)
                              : source.branch;

                            const effectiveBranchId = isBranchEditing
                              ? (branchEditBuffer[group.key]?.branch_id ?? group.branch_id)
                              : source.branch_id;

                            return (
                              <div key={cameraKey} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                  <div className="font-medium">กล้อง {source.camera_id}</div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleManageRoi(source.camera_id)}
                                      className="flex items-center px-3 py-1 bg-purple-500 text-white rounded-md text-sm hover:bg-purple-600"
                                    >
                                      <Edit2 size={14} className="mr-1" /> จัดการ ROI
                                    </button>

                                    <button
                                      onClick={() => toggleViewForCamera(cameraKey)}
                                      className={`flex items-center px-3 py-1 rounded-md text-sm transition-colors ${viewEnabledMap[cameraKey] ? 'bg-blue-600 text-white' : 'bg-red-500 text-white hover:bg-red-600'}`}
                                    >
                                      <Monitor size={14} className="mr-1 " />{viewEnabledMap[cameraKey] ? 'ปิดการดู' : 'ดูวิดีโอ'}
                                    </button>

                                    {!isCamEditing ? (
                                      <button
                                        onClick={() => startEditForCamera(cameraKey, realIndex)}
                                        className="flex items-center px-3 py-1 rounded-md text-sm transition-colors bg-yellow-500 text-white hover:bg-yellow-600"
                                      >
                                        <Edit2 size={14} className="mr-1" /> แก้ไขกล้อง
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => saveCameraEdits(cameraKey)}
                                          className="flex items-center px-3 py-1 rounded-md text-sm transition-colors bg-green-600 text-white hover:bg-green-700"
                                        >
                                          <Save size={14} className="mr-1" /> บันทึกกล้อง
                                        </button>

                                        <button
                                          onClick={() => cancelEditForCamera(cameraKey, realIndex)}
                                          className="flex items-center px-3 py-1 rounded-md text-sm bg-gray-200 hover:bg-gray-300"
                                        >
                                          ยกเลิกแก้ไข
                                        </button>

                                        {group.sources.length >= 1 && (
                                          <button
                                            onClick={async () => {
                                              const confirmed = window.confirm(`⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบ กล้อง "${source.camera_id}"?`);
                                              if (!confirmed) return;
                                              await removeVideoSource(realIndex, cameraKey);
                                            }}
                                            className="flex items-center px-3 py-1 text-white bg-red-600 rounded-md hover:bg-red-700 text-sm"
                                            title="ลบกล้อง"
                                          >
                                            <Trash2 size={16} className="mr-1" /> ลบกล้อง
                                          </button>
                                        )} 
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* camera-level fields */}
                                {(() => {
                                  const isViewing = Boolean(viewEnabledMap[cameraKey]);

                                  // ถ้าไม่ได้เปิดดูวิดีโอ: 2 คอลัมน์ (InputField | CameraConfig)
                                  if (!isViewing) {
                                    return (
                                      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                        <div>
                                          <InputField
                                            label="Camera ID"
                                            value={source.camera_id}
                                            onChange={(v) => updateVideoSource(realIndex, 'camera_id', String(v))}
                                            disabled={!isCamEditing}
                                          />
                                        </div>

                                        <div>
                                          <CameraConfig
                                            source={source}
                                            index={realIndex}
                                            updateVideoSource={updateVideoSource}
                                            branchId={source.branch_id}
                                            disabled={!isCamEditing}
                                            overrideBranch={isBranchEditing ? (branchEditBuffer[group.key]?.displayName ?? group.displayName) : undefined}
                                            overrideBranchId={isBranchEditing ? (branchEditBuffer[group.key]?.branch_id ?? group.branch_id) : undefined}
                                          />
                                        </div>
                                      </div>
                                    );
                                  }

                                  // ถ้าเปิดดูวิดีโอ: คอลัมน์ซ้าย stacked, คอลัมน์ขวาเป็น VideoPanel
                                  return (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-3">
                                        <div>
                                          <InputField
                                            label="Camera ID"
                                            value={source.camera_id}
                                            onChange={(v) => updateVideoSource(realIndex, 'camera_id', String(v))}
                                            disabled={!isCamEditing}
                                          />
                                        </div>

                                        <div>
                                          <CameraConfig
                                            source={source}
                                            index={realIndex}
                                            updateVideoSource={updateVideoSource}
                                            branchId={source.branch_id}
                                            disabled={!isCamEditing}
                                            overrideBranch={isBranchEditing ? (branchEditBuffer[group.key]?.displayName ?? group.displayName) : undefined}
                                            overrideBranchId={isBranchEditing ? (branchEditBuffer[group.key]?.branch_id ?? group.branch_id) : undefined}
                                          />
                                        </div>
                                      </div>

                                      <div>
                                        {viewEnabledMap[cameraKey] && (
                                          <div className="mt-3">
                                            <VideoPanel 
                                              cameraId={streamId} 
                                              width={480} 
                                              height={210} 
                                          />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}

              {groups.length === 0 && (<div className="text-center py-8">ยังไม่มีข้อมูลกล้อง — กด "เพิ่มสาขาใหม่" เพื่อเริ่มต้น</div>)}

              <div className="flex justify-end">
                <button
                  onClick={addBranch}
                  className="flex items-center space-x-2 bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
                >
                  <Plus size={16} />
                  <span>เพิ่มสาขาใหม่</span>
                </button>
              </div>
            </div>
          )}

          
          {activeTab === 'parking' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">การตั้งค่าการจอดรถ</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField
                  label="เวลาจอดสูงสุด (นาที)"
                  value={config.parking_time_limit_minutes}
                  onChange={(value) => updateConfig('parking_time_limit_minutes', value)}
                  type="number"
                />

                {/* <InputField
                  label="เวลาขั้นต่ำที่จะถือว่าจอด (วินาที)"
                  value={config.parking_time_threshold_seconds}
                  onChange={(value) => updateConfig('parking_time_threshold_seconds', value)}
                  type="number"
                />

                <InputField
                  label="Grace Period Frames (เฟรมที่ยอมให้ออกนอกโซน)"
                  value={config.grace_period_frames_exit}
                  onChange={(value) => updateConfig('grace_period_frames_exit', value)}
                  type="number"
                />

                <InputField
                  label="Timeout รถจอด (วินาที)"
                  value={config.parked_car_timeout_seconds}
                  onChange={(value) => updateConfig('parked_car_timeout_seconds', value)}
                  type="number"
                />

                <InputField
                  label="Movement Threshold (พิกเซล)"
                  value={config.movement_threshold_px}
                  onChange={(value) => updateConfig('movement_threshold_px', value)}
                  type="number"
                />

                <InputField
                  label="Movement Frame Window"
                  value={config.movement_frame_window}
                  onChange={(value) => updateConfig('movement_frame_window', value)}
                  type="number"
                /> */}
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">การตั้งค่าอื่นๆ</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* <InputField
                    label="API Key"
                    value={config.api_key}
                    onChange={(value) => updateConfig('api_key', value)}
                  /> */}

                  <InputField
                    label="Output Directory(ดูผลที่บันทึกไว้)"
                    value={config.output_dir}
                    onChange={(value) => updateConfig('output_dir', value)}
                  />

                  <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <CheckboxField
                      label="บันทึกวิดีโอ"
                      value={config.save_video}
                      onChange={(value) => updateConfig('save_video', value)}
                    />

                    <CheckboxField
                      label="บันทึกผล MOT"
                      value={config.save_mot_results}
                      onChange={(value) => updateConfig('save_mot_results', value)}
                    />

                    <CheckboxField
                      label="ปรับความสว่าง"
                      value={config.enable_brightness_adjustment}
                      onChange={(value) => updateConfig('enable_brightness_adjustment', value)}
                    />

                    <SelectField
                      label="วิธีปรับความสว่าง"
                      value={config.brightness_method}
                      onChange={(value) => updateConfig('brightness_method', value)}
                      options={[
                        { value: 'clahe', label: 'CLAHE' },
                        { value: 'histogram', label: 'Histogram' }
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">การตั้งค่าประสิทธิภาพ</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField
                  label="ความกว้างของเฟรมที่ส่งเข้าโมเดล"
                  value={config.performance_settings.target_inference_width}
                  onChange={(value) => updateConfig('performance_settings.target_inference_width', value)}
                  type="number"
                />

                <InputField
                  label="จำนวนเฟรมที่ข้าม (1 = ไม่ข้าม)"
                  value={config.performance_settings.frames_to_skip}
                  onChange={(value) => updateConfig('performance_settings.frames_to_skip', value)}
                  type="number"
                />

                {/* <InputField
                  label="ขนาด Queue สูงสุด"
                  value={config.queue_max_size}
                  onChange={(value) => updateConfig('queue_max_size', value)}
                  type="number"
                /> */}

                <CheckboxField
                  label="แสดง Bounding Box(กรอบรอบรถ)"
                  value={config.performance_settings.draw_bounding_box}
                  onChange={(value) => updateConfig('performance_settings.draw_bounding_box', value)}
                />

                <CheckboxField
                  label="Half Precision (GPU เท่านั้น)"
                  value={config.half_precision}
                  onChange={(value) => updateConfig('half_precision', value)}
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="text-yellow-600 mt-1" size={20} />
                  <div>
                    <h4 className="font-medium text-yellow-800">คำแนะนำการปรับแต่งประสิทธิภาพ</h4>
                    <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside space-y-1">
                      <li>ลด frames_to_skip ถ้าต้องการความแม่นยำสูง (แต่จะช้าลง)</li>
                      <li>เพิ่ม frames_to_skip ถ้าต้องการความเร็วสูง (แต่อาจพลาดเหตุการณ์)</li>
                      <li>ลด target_inference_width สำหรับเครื่องที่ช้า</li>
                      <li>เปิด Half Precision เฉพาะเมื่อใช้ GPU</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'display' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">การตั้งค่าการแสดงผล</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputField
                  label="ความกว้างสูงสุดของหน้าต่าง"
                  value={config.display_combined_max_width}
                  onChange={(value) => updateConfig('display_combined_max_width', value)}
                  type="number"
                />

                <InputField
                  label="ความสูงสูงสุดของหน้าต่าง"
                  value={config.display_combined_max_height}
                  onChange={(value) => updateConfig('display_combined_max_height', value)}
                  type="number"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Monitor className="text-blue-600 mt-1" size={20} />
                  <div>
                    <h4 className="font-medium text-blue-800">การแสดงผลแบบ Real-time</h4>
                    <p className="mt-2 text-sm text-blue-700">
                      ขนาดหน้าต่างจะปรับอัตโนมัติตามความละเอียดของวิดีโอต้นฉบับ
                      แต่จะไม่เกินค่าสูงสุดที่กำหนดไว้
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Preview */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">ตัวอย่าง YAML ที่จะได้</h3>
          <pre className="bg-gray-100 rounded-lg p-4 overflow-auto text-sm font-mono max-h-96">
            {generateYAML()}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ConfigManager;