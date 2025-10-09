// src/components/VideoPanel.tsx
import React, { useEffect, useRef, useState } from "react";

const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`;

interface VideoPanelProps {
  cameraId: string;
  wsUrl?: string; // optional เพราะเราจะสร้างอัตโนมัติจาก API_BASE_URL
  width?: number;
  height?: number;
  autoReconnect?: boolean;
  reconnectIntervalMs?: number;
}

const VideoPanel: React.FC<VideoPanelProps> = ({
  cameraId,
  wsUrl,
  width = 480,
  height = 270,
  autoReconnect = true,
  reconnectIntervalMs = 2000,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    connect(); // เริ่มเชื่อมต่อ WebSocket

    return () => {
      mounted.current = false;
      cleanupWs();
      if (reconnectTimer.current) {
        window.clearTimeout(reconnectTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId]);

  // 🔧 ปิด WS เมื่อ unmount
  const cleanupWs = () => {
    const ws = wsRef.current;
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        console.warn("[VideoPanel] cleanup error", e);
      }
      wsRef.current = null;
    }
    setConnected(false);
  };

  // 🔁 ตั้ง reconnect ถ้า WS หลุด
  const scheduleReconnect = () => {
    if (!autoReconnect || !mounted.current) return;
    if (reconnectTimer.current) return;
    reconnectTimer.current = window.setTimeout(() => {
      reconnectTimer.current = null;
      connect();
    }, reconnectIntervalMs);
  };

  // 🔌 สร้าง connection ใหม่
  const connect = () => {
    const finalUrl =
        wsUrl ||
        `${window.location.protocol === "https:" ? "wss" : "ws"}://${
            window.location.hostname
        }:8000/api/ws/ai-frames/${encodeURIComponent(cameraId)}`;

    console.log("[VideoPanel] Connecting to", finalUrl);
    const ws = new WebSocket(finalUrl);

    ws.onopen = () => {
      console.log("[VideoPanel] Connected to", finalUrl);
      setConnected(true);
    };

    ws.onmessage = (event) => {
      // 🔍 ตรวจสอบว่าเป็น binary หรือ text
      if (typeof event.data === "string") {
        handleTextMessage(event.data);
      } else if (event.data instanceof Blob) {
        handleBinaryMessage(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        handleBinaryMessage(new Blob([event.data], { type: "image/jpeg" }));
      }
    };

    ws.onerror = (err) => {
      console.error("[VideoPanel] websocket error", err);
    };

    ws.onclose = () => {
      console.warn("[VideoPanel] disconnected, retrying...");
      setConnected(false);
      scheduleReconnect();
    };

    wsRef.current = ws;
  };

  // 🧠 เมื่อ message เป็นข้อความ (base64 หรือ JSON)
  const handleTextMessage = (text: string) => {
    try {
      let base64 = text;
      if (text.startsWith("{")) {
        const obj = JSON.parse(text);
        if (obj && (obj.data || obj.img)) {
          base64 = obj.data || obj.img;
        } else if (obj.type === "status") {
          // ignore status messages
          return;
        } else {
          // unknown json payload
          return;
        }
      }
      drawBase64ToCanvas(base64);
    } catch (e) {
      console.error("[VideoPanel] failed parse text message", e);
    }
  };

  // 🧩 เมื่อ message เป็น binary
  const handleBinaryMessage = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    drawImageUrlToCanvas(url, () => URL.revokeObjectURL(url));
  };

  // 🎨 แปลง base64 → แสดงบน canvas
  const drawBase64ToCanvas = (base64Data: string) => {
    let src = base64Data;
    if (!/^data:/.test(base64Data)) {
      src = `data:image/jpeg;base64,${base64Data}`;
    }
    drawImageUrlToCanvas(src);
  };

  // 🖼️ วาดรูปลง canvas
  const drawImageUrlToCanvas = (url: string, onloadCleanup?: () => void) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      const cw = width;
      const ch = height;
      const scale = Math.min(cw / img.width, ch / img.height);
      const nw = Math.round(img.width * scale);
      const nh = Math.round(img.height * scale);
      canvas.width = nw;
      canvas.height = nh;
      ctx.clearRect(0, 0, nw, nh);
      ctx.drawImage(img, 0, 0, nw, nh);
      if (onloadCleanup) onloadCleanup();
    };
    img.onerror = () => {
      if (onloadCleanup) onloadCleanup();
    };
    img.src = url;
  };

  return (
    <div className="border rounded-md p-2 bg-black">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-white">
          Live: {cameraId}{" "}
          {connected ? (
            <span className="text-green-300 ml-2">●</span>
          ) : (
            <span className="text-red-300 ml-2">●</span>
          )}
        </div>
        <div className="text-xs text-gray-300">
          {connected ? "Connected" : "Disconnected"}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: width + "px",
          height: height + "px",
          display: "block",
          background: "#222",
        }}
      />
    </div>
  );
};

export default VideoPanel;
