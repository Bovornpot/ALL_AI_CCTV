// src/components/AILogConsole.tsx
import React, { useEffect, useRef, useState } from "react";
import { Cpu, AlertTriangle } from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.host}`;
const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/api/ws/ai-logs";

const AILogConsole: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<"running" | "stopped" | "unknown">("unknown");
  const [wsConnected, setWsConnected] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // --- ดึงสถานะ AI จาก backend ---
  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/status`);
      const data = await res.json();
      const s = (data.status as "running" | "stopped") ?? "unknown";
      setStatus(s);
      setAiRunning(s === "running");
    } catch {
      setStatus("unknown");
      setAiRunning(false);
    }
  };

  // --- start/stop AI ---
  const startAI = async () => {
    setStartError(null);
    setLogs((prev) => [...prev, ">> START requested"]);
    try {
      // ส่ง body แบบ JSON เสมอเพื่อให้ backend ที่ใช้ Pydantic ไม่ return 422
      const body = {
        show_display: false,
        ws_enable: true,
        ws_host: window.location.hostname,
        ws_port: 8765
      };

      const res = await fetch(`${API_BASE_URL}/api/ai/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // if (!res.ok) {
      //   // อ่านรายละเอียด error ให้ชัดเจน (รองรับ JSON หรือ plain text)
      //   let detail = "";
      //   try {
      //     const json = await res.json();
      //     detail = json.detail ? JSON.stringify(json.detail) : JSON.stringify(json);
      //   } catch {
      //     detail = await res.text();
      //   }
      //   alert(`เริ่ม AI ไม่ได้: ${res.status} ${detail}`);
      //   return;
      // }
      if (!res.ok) {
          const errorData = await res.json();
          const errorMessage = errorData.detail || "Failed to start AI. Unknown error.";
          setStartError(errorMessage);
          // ไม่ต้อง alert แล้ว เพราะเราจะแสดงเป็นกล่องข้อความ
          return;
      }

      const data = await res.json().catch(() => null);
      setLogs((prev) => [...prev, ">> START requested", data ? `>> ${JSON.stringify(data)}` : ""] );
      setStatus("running");
      setAiRunning(true);
      alert("✅ AI Started");
    } catch (err: any) {
      console.error("startAI error:", err);
      alert(`❌ เริ่ม AI ไม่ได้: ${err?.message ?? String(err)}`);
    }
  };

  const stopAI = async () => {
    if (!window.confirm("คุณแน่ใจหรือไม่ว่าต้องการหยุด AI ?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/stop`, { method: "POST" });
      if (!res.ok) {
        let detail = "";
        try {
          const json = await res.json();
          detail = json.detail ? JSON.stringify(json.detail) : JSON.stringify(json);
        } catch {
          detail = await res.text();
        }
        alert(`หยุด AI ไม่ได้: ${res.status} ${detail}`);
        return;
      }
      setLogs((prev) => [...prev, ">> STOP requested"]);
      setStatus("stopped");
      setAiRunning(false);
      alert("🛑 AI Stopped");
    } catch (err: any) {
      console.error("stopAI error:", err);
      alert(`❌ หยุด AI ไม่ได้: ${err?.message ?? String(err)}`);
    }
  };

  // --- ครั้งแรก โหลด status ---
  useEffect(() => {
    fetchStatus();
  }, []);

  // --- จัดการ websocket logs ---
  useEffect(() => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      console.warn("WebSocket creation failed:", e);
      return;
    }

    wsRef.current = ws;

    let keepAlive: number | undefined;
    ws.onopen = () => {
      setWsConnected(true);
      // keepalive ping every 20s (ลด frequency)
      keepAlive = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send("ping");
          } catch (e) {
            // ignore
          }
        }
      }, 20000);
      (ws as any)._keepAlive = keepAlive;
    };

    ws.onmessage = (ev) => {
      setLogs((prev) => {
        const next = [...prev, ev.data as string];
        if (next.length > 2000) next.splice(0, next.length - 2000);
        return next;
      });
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      if ((ws as any)._keepAlive) clearInterval((ws as any)._keepAlive);
      // auto reconnect: drop current wsRef then reconnect via effect re-run won't happen,
      // so we schedule a manual reconnect attempt
      setTimeout(() => {
        if (wsRef.current === ws) wsRef.current = null;
        // try reconnect
        try {
          const newWs = new WebSocket(WS_URL);
          wsRef.current = newWs;
          // we won't reattach all handlers here to avoid complexity; rely on user refresh or new mount.
        } catch {
          // ignore
        }
      }, 1500);
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    return () => {
      try {
        if ((ws as any)._keepAlive) clearInterval((ws as any)._keepAlive);
        ws.close();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once

  return (
    <div className="bg-white rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">AI Realtime Logs</h3>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded text-sm ${
              status === "running" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
            }`}
          >
            {status === "running" ? "RUNNING" : status.toUpperCase()}
          </span>
          <span
            className={`px-2 py-1 rounded text-sm ${
              wsConnected ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
            }`}
          >
            WS: {wsConnected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="font-mono text-sm bg-black text-green-200 rounded p-3 h-72 overflow-auto"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {logs.join("\n")}
      </div>

      {/* <div className="mt-3 flex gap-3">
        {!aiRunning ? (
          <button
            onClick={startAI}
            className="flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
          >
            <Cpu size={20} />
            <span>Start AI</span>
          </button>
        ) : (
          <button
            onClick={stopAI}
            className="flex items-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors shadow-lg"
          >
            <AlertTriangle size={20} />
            <span>Stop AI</span>
          </button>
        )}
      </div> */}
      <div className="mt-3 flex items-start gap-4">
          <div className="flex-shrink-0">
              {!aiRunning ? (
                  <button onClick={startAI} className="flex items-center space-x-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors shadow-lg">
                      <Cpu size={20} />
                      <span>Start AI</span>
                  </button>
              ) : (
                  <button onClick={stopAI} className="flex items-center space-x-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors shadow-lg">
                      <AlertTriangle size={20} />
                      <span>Stop AI</span>
                  </button>
              )}
          </div>

          {startError && (
              <div className="flex-grow bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">
                  <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                      <p style={{ whiteSpace: 'pre-wrap' }}>
                          {startError}
                      </p>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default AILogConsole;
