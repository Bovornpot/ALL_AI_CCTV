// src/components/ROIManager.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, XCircle, Plus, Trash2 } from 'lucide-react';
const API_BASE_URL = process.env.REACT_APP_API_URL;

// ฟังก์ชันสำหรับสร้าง UUID (Unique ID) แบบง่ายๆ
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// ประเภทสำหรับ ROI แต่ละชุด
interface RoiSet {
    id: string;
    points: number[][];
    color: string;
    name: string;
}

const ROIManager = () => {
    const { camera_id } = useParams<{ camera_id: string }>();
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
    const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number, height: number } | null>(null);
    const [allRois, setAllRois] = useState<RoiSet[]>([]);
    const [currentDrawingPoints, setCurrentDrawingPoints] = useState<number[][]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const getRandomColor = () => {
        const colors = ['#e57373', '#64b5f6', '#81c784', '#ba68c8', '#ffb74d', '#4dd0e1'];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    // ---------- Utility: merge แบบกันซ้ำ ----------
    const mergeUniqueRois = (existing: RoiSet[], incoming: RoiSet[]): RoiSet[] => {
        const seenIds = new Set(existing.map(r => r.id));
        const seenNames = new Set(existing.map(r => r.name));
        const merged = [...existing];

        for (const roi of incoming) {
            if (!seenIds.has(roi.id) && !seenNames.has(roi.name)) {
                merged.push(roi);
                seenIds.add(roi.id);
                seenNames.add(roi.name);
            } else {
                console.warn(`Duplicate ROI skipped: id=${roi.id}, name=${roi.name}`);
            }
        }
        return merged;
    };

    const getNextZoneNumber = (existing: RoiSet[]) => {
        const existingNames = new Set(existing.map(r => r.name));
        let zoneNumber = existing.length + 1;
        while (existingNames.has(`Zone ${zoneNumber}`)) {
            zoneNumber++;
            if (zoneNumber > existing.length + 1000) break;
        }
        return zoneNumber;
    };

    // โหลดภาพและ ROI ที่บันทึกไว้
    useEffect(() => {
        const fetchImage = async () => {
            if (!camera_id) {
                setError("ไม่พบ Camera ID");
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                const response = await fetch(`${API_BASE_URL}/api/video-frame/${camera_id}`);
                // const response = await fetch(`http://localhost:8000/api/video-frame/${camera_id}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to fetch video frame: ${response.status} ${errorText}`);
                }
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    setBackgroundImage(img);
                    setOriginalImageDimensions({ width: img.width, height: img.height });
                    if (canvasRef.current) {
                        canvasRef.current.width = img.width;
                        canvasRef.current.height = img.height;
                    }
                    setLoading(false);
                    URL.revokeObjectURL(url);
                };
                img.onerror = () => {
                    setError("ไม่สามารถโหลดภาพจากวิดีโอได้ ตรวจสอบ Path ไฟล์วิดีโอและ Backend");
                    setLoading(false);
                    URL.revokeObjectURL(url);
                };
                img.src = url;
            } catch (err: any) {
                console.error("Error fetching video frame:", err);
                setError(`เกิดข้อผิดพลาดในการโหลดภาพ: ${err.message}`);
                setLoading(false);
            }
        };

        const fetchSavedRoi = async () => {
            if (!camera_id) return;

            try {
                const response = await fetch(`${API_BASE_URL}/api/roi/polygons/${camera_id}`);
                if (response.ok) {
                const savedData: number[][][] = await response.json();
                if (savedData.length > 0) {
                    const loadedRois: RoiSet[] = savedData.map((points, index) => ({
                    id: generateUUID(),
                    points,
                    color: getRandomColor(),
                    name: `Zone ${index + 1}`,
                    }));

                    setAllRois(prev => mergeUniqueRois(prev, loadedRois));
                } else {
                    console.log("✅ No ROI data found, starting fresh.");
                }
                } else {
                console.warn("⚠️ Failed to fetch ROI data:", response.status);
                }
            } catch (err) {
                console.error("❌ Error loading ROI JSON:", err);
            }
        };

        if (camera_id) {
            fetchImage();
            fetchSavedRoi();
        }
    }, [camera_id]);

    // ฟังก์ชันวาดบน Canvas
    const drawOnCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !backgroundImage || !originalImageDimensions) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

        allRois.forEach(roiSet => {
            if (roiSet.points.length > 0) {
                ctx.beginPath();
                ctx.moveTo(roiSet.points[0][0], roiSet.points[0][1]);
                for (let i = 1; i < roiSet.points.length; i++) {
                    ctx.lineTo(roiSet.points[i][0], roiSet.points[i][1]);
                }
                ctx.closePath();
                ctx.strokeStyle = roiSet.color;
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = `${roiSet.color}40`;
                ctx.fill();

                ctx.fillStyle = roiSet.color;
                roiSet.points.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
                    ctx.fill();
                });

                if (roiSet.name) {
                    const firstPoint = roiSet.points[0];
                    ctx.font = '16px Arial';
                    ctx.fillStyle = roiSet.color;
                    ctx.fillText(roiSet.name, firstPoint[0] + 10, firstPoint[1] - 10);
                }
            }
        });

        if (currentDrawingPoints.length > 0) {
            ctx.beginPath();
            ctx.moveTo(currentDrawingPoints[0][0], currentDrawingPoints[0][1]);
            for (let i = 1; i < currentDrawingPoints.length; i++) {
                ctx.lineTo(currentDrawingPoints[i][0], currentDrawingPoints[i][1]);
            }
            ctx.strokeStyle = 'cyan';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = 'blue';
            currentDrawingPoints.forEach(point => {
                ctx.beginPath();
                ctx.arc(point[0], point[1], 5, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
    }, [backgroundImage, allRois, currentDrawingPoints, originalImageDimensions]);

    useEffect(() => {
        drawOnCanvas();
    }, [drawOnCanvas]);

    const isAddingRoiRef = useRef(false);

    // คลิก canvas เพื่อวาด ROI
    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (isAddingRoiRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas || !originalImageDimensions) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = originalImageDimensions.width / rect.width;
        const scaleY = originalImageDimensions.height / rect.height;
        const x = event.nativeEvent.offsetX * scaleX;
        const y = event.nativeEvent.offsetY * scaleY;

        if (isDrawing) {
            setCurrentDrawingPoints(prevPoints => {
                const newPoints = [...prevPoints, [x, y]];
                if (newPoints.length > 2 &&
                    Math.abs(newPoints[0][0] - x) < 10 &&
                    Math.abs(newPoints[0][1] - y) < 10) {
                    isAddingRoiRef.current = true;
                    const zoneNumber = getNextZoneNumber(allRois);
                    const newRoi: RoiSet = {
                        id: generateUUID(),
                        points: newPoints.slice(0, -1),
                        color: getRandomColor(),
                        name: `Zone ${zoneNumber}`
                    };
                    setAllRois(prev => mergeUniqueRois(prev, [newRoi]));
                    setCurrentDrawingPoints([]);
                    setIsDrawing(false);
                    setTimeout(() => { isAddingRoiRef.current = false; }, 500);
                    return [];
                }
                return newPoints;
            });
        }
    };

    const startNewRoi = () => {
        if (isDrawing && currentDrawingPoints.length > 0) {
            alert("คุณยังวาด ROI เก่าไม่เสร็จ กรุณาปิดรูปทรงหรือล้างก่อนเริ่มใหม่");
            return;
        }
        setCurrentDrawingPoints([]);
        setIsDrawing(true);
    };

    const handleClearCurrentDrawing = () => {
        setCurrentDrawingPoints([]);
        setIsDrawing(false);
    };

    const handleDeleteRoiSet = (id: string) => {
        if (window.confirm("คุณแน่ใจหรือไม่ที่จะลบ ROI ชุดนี้?")) {
            setAllRois(prev => prev.filter(roi => roi.id !== id));
        }
    };

    const handleSaveAllRois = async () => {
        if (!camera_id) return alert("ไม่พบ Camera ID");
        try {
            setIsSaving(true);
            const polygons = allRois.map(roi => roi.points);
            const response = await fetch(`${API_BASE_URL}/api/roi/save_zone_file`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ camera_id, polygons }),
            });
            if (!response.ok) throw new Error("Failed to save ROI");
            console.log("✅ ROI saved successfully");
            alert("✅ บันทึก ROI สำเร็จแล้ว"); 
        } catch (err) {
            console.error("Error saving ROI:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRoiNameChange = (id: string, newName: string) => {
        setAllRois(prevRois => {
            const nameExists = prevRois.some(r => r.name === newName && r.id !== id);
            if (nameExists) {
                alert("มีชื่อ Zone นี้อยู่แล้ว กรุณาเลือกชื่ออื่น");
                return prevRois;
            }
            return prevRois.map(roi =>
                roi.id === id ? { ...roi, name: newName } : roi
            );
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-4 mx-auto"></div>
                    <p className="text-gray-600">กำลังโหลดภาพวิดีโอ...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                    <p className="text-red-500 font-semibold mb-4">{error}</p>
                    <button
                        onClick={() => navigate('/ai-settings')}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        กลับสู่หน้าตั้งค่า
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center p-8 bg-gray-100 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">วาด ROI สำหรับกล้อง: {camera_id}</h1>
            <p className="text-gray-600 mb-4">
                <span className="font-bold">วิธีใช้งาน:</span> คลิกบนภาพเพื่อเพิ่มจุด ROI (ขั้นต่ำ 3 จุด).
                เมื่อต้องการปิดรูปทรง ให้คลิกที่จุดแรกอีกครั้ง.
                จากนั้นคุณสามารถ <span className="font-bold">เพิ่ม ROI ใหม่</span> ได้
            </p>

            <div className="flex w-full max-w-5xl mb-6 space-x-4">
                <div className="relative border-4 border-gray-300 rounded-lg shadow-xl overflow-hidden flex-grow">
                    <canvas
                        ref={canvasRef}
                        onClick={handleCanvasClick}
                        className="cursor-crosshair block w-full h-full"
                        style={{ display: backgroundImage ? 'block' : 'none' }}
                    />
                    {!backgroundImage && (
                        <div className="flex justify-center items-center h-64 w-full bg-gray-200 text-gray-500">
                            ไม่สามารถแสดงภาพวิดีโอ
                        </div>
                    )}
                </div>

                <div className="w-80 bg-white rounded-lg shadow-md p-4 flex-shrink-0">
                    <h2 className="text-xl font-bold mb-4">การจัดการ ROI</h2>
                    <button
                        onClick={startNewRoi}
                        className={`flex items-center space-x-2 px-4 py-2 mb-3 w-full rounded-md font-semibold transition-colors ${isDrawing ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                        disabled={isDrawing}
                    >
                        <Plus size={18} />
                        <span>เริ่มวาด ROI ใหม่</span>
                    </button>
                    <button
                        onClick={handleClearCurrentDrawing}
                        className="flex items-center space-x-2 px-4 py-2 mb-3 w-full bg-red-500 text-white rounded-md font-semibold hover:bg-red-600 transition-colors"
                    >
                        <XCircle size={18} />
                        <span>ล้างจุดที่กำลังวาด</span>
                    </button>
                    <button
                        onClick={handleSaveAllRois}
                        className={`flex items-center space-x-2 px-4 py-2 mb-6 w-full rounded-md font-semibold transition-colors ${isSaving ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'}`}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                                <span>กำลังบันทึก...</span>
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                <span>บันทึก ROI ทั้งหมด</span>
                            </>
                        )}
                    </button>

                    <h3 className="text-lg font-bold mb-3 border-t pt-4">ROI ที่วาดแล้ว ({allRois.length})</h3>
                    {allRois.length === 0 ? (
                        <p className="text-gray-500 text-sm">ยังไม่มี ROI</p>
                    ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {allRois.map(roi => (
                                <div key={roi.id} className="flex items-center justify-between bg-gray-100 p-2 rounded-md border border-gray-200">
                                    <input
                                        type="text"
                                        value={roi.name}
                                        onChange={(e) => handleRoiNameChange(roi.id, e.target.value)}
                                        className="flex-grow bg-transparent border-none focus:outline-none text-gray-800"
                                        style={{ color: roi.color }}
                                    />
                                    <button
                                        onClick={() => handleDeleteRoiSet(roi.id)}
                                        className="text-red-500 hover:text-red-700 ml-2"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => navigate('/ai-settings')}
                        className="mt-6 px-4 py-2 w-full bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                    >
                        กลับสู่หน้าตั้งค่าหลัก
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ROIManager;
