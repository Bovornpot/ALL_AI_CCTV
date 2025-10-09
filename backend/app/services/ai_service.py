import threading
import time

# ตัวแปรควบคุมการทำงาน AI
ai_running = False
ai_thread = None

def ai_task():
    global ai_running
    while ai_running:
        print("🚗 AI กำลังทำงาน...")
        time.sleep(2)  # แทนที่ด้วยโค้ด AI จริง เช่น YOLO detection

def start_ai():
    global ai_running, ai_thread
    if not ai_running:
        ai_running = True
        ai_thread = threading.Thread(target=ai_task, daemon=True)
        ai_thread.start()
        return {"status": "started"}
    return {"status": "already_running"}

def stop_ai():
    global ai_running
    if ai_running:
        ai_running = False
        return {"status": "stopped"}
    return {"status": "already_stopped"}
