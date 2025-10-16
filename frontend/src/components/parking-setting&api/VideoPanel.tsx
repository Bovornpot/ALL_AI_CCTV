// // src/components/VideoPanel.tsx
// import React, { useEffect, useRef, useState } from "react";

// const API_BASE_URL = "http://localhost:8000";

// interface VideoPanelProps {
//   cameraId: string;
//   wsUrl?: string; // optional เพราะเราจะสร้างอัตโนมัติจาก API_BASE_URL
//   width?: number;
//   height?: number;
//   autoReconnect?: boolean;
//   reconnectIntervalMs?: number;
// }

// const VideoPanel: React.FC<VideoPanelProps> = ({
//   cameraId,
//   wsUrl,
//   width = 480,
//   height = 270,
//   autoReconnect = true,
//   reconnectIntervalMs = 2000,
// }) => {
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);
//   const wsRef = useRef<WebSocket | null>(null);
//   const [connected, setConnected] = useState(false);
//   const reconnectTimer = useRef<number | null>(null);
//   const mounted = useRef(true);

//   useEffect(() => {
//     mounted.current = true;
//     connect(); // เริ่มเชื่อมต่อ WebSocket

//     return () => {
//       mounted.current = false;
//       cleanupWs();
//       if (reconnectTimer.current) {
//         window.clearTimeout(reconnectTimer.current);
//       }
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [cameraId]);

//   // 🔧 ปิด WS เมื่อ unmount
//   const cleanupWs = () => {
//     const ws = wsRef.current;
//     if (ws) {
//       try {
//         ws.close();
//       } catch (e) {
//         console.warn("[VideoPanel] cleanup error", e);
//       }
//       wsRef.current = null;
//     }
//     setConnected(false);
//   };

//   // 🔁 ตั้ง reconnect ถ้า WS หลุด
//   const scheduleReconnect = () => {
//     if (!autoReconnect || !mounted.current) return;
//     if (reconnectTimer.current) return;
//     reconnectTimer.current = window.setTimeout(() => {
//       reconnectTimer.current = null;
//       connect();
//     }, reconnectIntervalMs);
//   };

//    const connect = () => {
//     // ปิด connection เก่าก่อนสร้างใหม่ (สำคัญ)
//     cleanupWs();

//     // ใช้ API_BASE_URL (fallback ถ้ามี) แล้วแปลงเป็น ws/wss
//     const base = API_BASE_URL;
//     const wsBase = base.replace(/^http/, window.location.protocol === "https:" ? "wss" : "ws");
//     const finalUrl = wsUrl || `${wsBase.replace(/\/$/, "")}/api/ws/ai-frames/${encodeURIComponent(cameraId)}`;

//     console.log("[VideoPanel] Connecting to", finalUrl);

//     let ws: WebSocket | null = null;
//     try {
//       ws = new WebSocket(finalUrl);
//       // ให้ browser ส่ง binary เป็น ArrayBuffer (ช่วยให้ consistent)
//       (ws as any).binaryType = "arraybuffer";
//     } catch (err) {
//       console.error("[VideoPanel] WebSocket constructor failed:", err);
//       // schedule reconnect และ return
//       scheduleReconnect();
//       return;
//     }

//     ws.onopen = () => {
//       console.log("[VideoPanel] Connected to", finalUrl);
//       setConnected(true);
//     };

//     ws.onmessage = (event) => {
//       // ถ้าเป็น text / json / base64
//       if (typeof event.data === "string") {
//         handleTextMessage(event.data);
//         return;
//       }
//       // ถ้าเป็น ArrayBuffer (เราตั้ง binaryType = arraybuffer)
//       if (event.data instanceof ArrayBuffer) {
//         const blob = new Blob([event.data], { type: "image/jpeg" });
//         handleBinaryMessage(blob);
//         return;
//       }
//       // ถ้าเป็น Blob (บาง server อาจส่ง Blob)
//       if (event.data instanceof Blob) {
//         handleBinaryMessage(event.data);
//         return;
//       }
//       // Unknown type
//       console.warn("[VideoPanel] Unknown message.data type:", typeof event.data);
//     };

//     ws.onerror = (err) => {
//       console.error("[VideoPanel] websocket error", err);
//     };

//     ws.onclose = (ev) => {
//       console.warn("[VideoPanel] disconnected (code=" + ev.code + "), will retry...");
//       setConnected(false);
//       scheduleReconnect();
//     };

//     wsRef.current = ws;
//   };


//   // 🧠 เมื่อ message เป็นข้อความ (base64 หรือ JSON)
//   const handleTextMessage = (text: string) => {
//     try {
//       let base64 = text;
//       if (text.startsWith("{")) {
//         const obj = JSON.parse(text);
//         if (obj && (obj.data || obj.img)) {
//           base64 = obj.data || obj.img;
//         } else if (obj.type === "status") {
//           // ignore status messages
//           return;
//         } else {
//           // unknown json payload
//           return;
//         }
//       }
//       drawBase64ToCanvas(base64);
//     } catch (e) {
//       console.error("[VideoPanel] failed parse text message", e);
//     }
//   };

//   // 🧩 เมื่อ message เป็น binary
//   const handleBinaryMessage = (blob: Blob) => {
//     const url = URL.createObjectURL(blob);
//     drawImageUrlToCanvas(url, () => URL.revokeObjectURL(url));
//   };

//   // 🎨 แปลง base64 → แสดงบน canvas
//   const drawBase64ToCanvas = (base64Data: string) => {
//     let src = base64Data;
//     if (!/^data:/.test(base64Data)) {
//       src = `data:image/jpeg;base64,${base64Data}`;
//     }
//     drawImageUrlToCanvas(src);
//   };

//   // 🖼️ วาดรูปลง canvas
//   const drawImageUrlToCanvas = (url: string, onloadCleanup?: () => void) => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const ctx = canvas.getContext("2d");
//     if (!ctx) return;
//     const img = new Image();
//     img.onload = () => {
//       const cw = width;
//       const ch = height;
//       const scale = Math.min(cw / img.width, ch / img.height);
//       const nw = Math.round(img.width * scale);
//       const nh = Math.round(img.height * scale);
//       canvas.width = nw;
//       canvas.height = nh;
//       ctx.clearRect(0, 0, nw, nh);
//       ctx.drawImage(img, 0, 0, nw, nh);
//       if (onloadCleanup) onloadCleanup();
//     };
//     img.onerror = () => {
//       if (onloadCleanup) onloadCleanup();
//     };
//     img.src = url;
//   };

//   return (
//     <div className="border rounded-md p-2 bg-black">
//       <div className="flex items-center justify-between mb-2">
//         <div className="text-sm text-white">
//           Live: {cameraId}{" "}
//           {connected ? (
//             <span className="text-green-300 ml-2">●</span>
//           ) : (
//             <span className="text-red-300 ml-2">●</span>
//           )}
//         </div>
//         <div className="text-xs text-gray-300">
//           {connected ? "Connected" : "Disconnected"}
//         </div>
//       </div>
//       <canvas
//         ref={canvasRef}
//         style={{
//           width: width + "px",
//           height: height + "px",
//           display: "block",
//           background: "#222",
//         }}
//       />
//     </div>
//   );
// };

// export default VideoPanel;
// src/components/VideoPanel.tsx
// src/components/VideoPanel.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`;

interface VideoPanelProps {
  cameraId: string;
  wsUrl?: string;
  width?: number;
  height?: number;
  autoReconnect?: boolean;
  reconnectIntervalMs?: number;
}

const VideoPanel: React.FC<VideoPanelProps> = ({
  cameraId,
  wsUrl,
  // --- 🔽 1. ปรับขนาดเริ่มต้นให้ใหญ่ขึ้น 🔽 ---
  width = 854,   // (จาก 480)
  height = 480,  // (จาก 270)
  autoReconnect = true,
  reconnectIntervalMs = 2000,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // --- 🔽 2. สร้าง Ref สำหรับ Div ที่จะขยายเต็มจอ 🔽 ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<number | null>(null);
  // --- 🔽 3. เพิ่ม State สำหรับจัดการโหมดเต็มจอ 🔽 ---
  const [isFullScreen, setIsFullScreen] = useState(false);


  // --- ฟังก์ชันทั้งหมดที่ห่อด้วย useCallback เหมือนเดิม ---
  const drawImageUrlToCanvas = useCallback((url: string, onloadCleanup?: () => void) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        // ถ้าเต็มจอ ให้ใช้ขนาดของ container, ถ้าไม่เต็ม ให้ใช้ props width/height
        const targetWidth = isFullScreen ? containerRef.current?.clientWidth ?? window.innerWidth : width;
        const targetHeight = isFullScreen ? containerRef.current?.clientHeight ?? window.innerHeight : height;
        
        const scale = Math.min(targetWidth / img.width, targetHeight / img.height);
        const nw = Math.round(img.width * scale);
        const nh = Math.round(img.height * scale);
        
        canvas.width = nw;
        canvas.height = nh;
        
        ctx.drawImage(img, 0, 0, nw, nh);
        if (onloadCleanup) onloadCleanup();
      };
      img.onerror = () => { if (onloadCleanup) onloadCleanup(); };
      img.src = url;
    }, [width, height, isFullScreen] // <-- เพิ่ม isFullScreen เข้าไปใน dependency
  );
  
  const drawBase64ToCanvas = useCallback((base64Data: string) => {
    let src = base64Data;
    if (!/^data:/.test(base64Data)) {
      src = `data:image/jpeg;base64,${base64Data}`;
    }
    drawImageUrlToCanvas(src);
  }, [drawImageUrlToCanvas]);

  const handleTextMessage = useCallback((text: string) => {
    try {
      let base64 = text;
      if (text.startsWith("{")) {
        const obj = JSON.parse(text);
        if (obj && (obj.data || obj.img)) {
          base64 = obj.data || obj.img;
        } else { return; }
      }
      drawBase64ToCanvas(base64);
    } catch (e) {
      console.error("[VideoPanel] failed parse text message", e);
    }
  }, [drawBase64ToCanvas]);

  const cleanupWs = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    cleanupWs();
    const base = API_BASE_URL;
    const wsBase = base.replace(/^http/, "ws");
    const finalUrl = wsUrl || `${wsBase.replace(/\/$/, "")}/api/ws/ai-frames/${encodeURIComponent(cameraId)}`;
    console.log("[VideoPanel] Connecting to", finalUrl);
    const ws = new WebSocket(finalUrl);
    wsRef.current = ws;
    ws.binaryType = "blob";

    ws.onopen = () => { setConnected(true); };
    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        const url = URL.createObjectURL(event.data);
        drawImageUrlToCanvas(url, () => URL.revokeObjectURL(url));
      } else if (typeof event.data === "string") {
        handleTextMessage(event.data);
      }
    };
    ws.onerror = (err) => { console.error("[VideoPanel] websocket error", err); };
    ws.onclose = (ev) => {
      console.warn(`[VideoPanel] disconnected (code=${ev.code})`);
      setConnected(false);
      if (autoReconnect) {
        reconnectTimer.current = window.setTimeout(connect, reconnectIntervalMs);
      }
    };
  }, [cameraId, wsUrl, autoReconnect, reconnectIntervalMs, cleanupWs, drawImageUrlToCanvas, handleTextMessage]);

  useEffect(() => {
    connect();
    return () => { cleanupWs(); };
  }, [connect, cleanupWs]);

  // --- 🔽 4. เพิ่มฟังก์ชันสำหรับสลับโหมดเต็มจอ 🔽 ---
  const handleToggleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // --- 🔽 5. เพิ่ม Effect สำหรับ Sync สถานะเต็มจอกับเบราว์เซอร์ 🔽 ---
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullScreenChange);
  }, []);


  return (
    // --- 🔽 6. แก้ไข JSX ให้รองรับโหมดเต็มจอ 🔽 ---
    <div
      ref={containerRef}
      onDoubleClick={handleToggleFullScreen}
      className={`border rounded-md p-2 bg-black transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50 w-screen h-screen flex items-center justify-center' : ''}`}
      style={!isFullScreen ? { width: `${width}px` } : {}}
    >
      <div className={`flex flex-col ${isFullScreen ? 'w-full h-full' : ''}`}>
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <div className="text-sm text-white">
            Live: {cameraId}{" "}
            {connected ? (
              <span className="text-green-300 ml-2">●</span>
            ) : (
              <span className="text-red-300 ml-2">●</span>
            )}
          </div>
          <div className="text-xs text-gray-300">
            {isFullScreen ? '(Double-click to exit fullscreen)' : '(Double-click for fullscreen)'}
          </div>
        </div>
        <div className={`relative flex-grow flex items-center justify-center ${isFullScreen ? 'w-full h-full' : ''}`}>
          <canvas
            ref={canvasRef}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              background: "#222",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoPanel;