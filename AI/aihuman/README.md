## `README.md` (สั้น ๆ)

```markdown
# aihuman
Multi-camera trajectory-based ReID & Heatmap (prototype)

## Setup
1. Create virtualenv (recommended)
2. Install requirements: `pip install -r requirements.txt`
3. Put your YOLO weights at `aihuman/weights/yolov12s.pt` or update `config_human.yaml`
4. Edit `config_human.yaml` homography matrices and rtsp streams
5. Run: `python main.py`

Notes: This is a prototype. For production, use proper ByteTrack installation, GPU acceleration, DB storage, and robust exception handling.
```

---

# หมายเหตุสำคัญ

* โค้ดใน repo นี้เป็น **prototype** เพื่อเริ่มทดลองตามบทความ MDPI โดยโฟลเดอร์ `aihuman/` ต้องมีไฟล์ weights และ assets ที่จำเป็น (floorplan image ฯลฯ)
* ถ้าต้องการ ผมสามารถทำให้เป็น `git repo` แบบพร้อมดาวน์โหลด หรือสร้างไฟล์จริงในเครื่องของคุณ (แต่ผมไม่สามารถเข้าถึงไฟล์เครื่องคุณโดยตรง) — ผมจะช่วยส่งเนื้อหาไฟล์ทั้งหมดให้ คุณก็แค่คัดลอกและวางลงในไฟล์ภายใน `C:\Users\chayaphonlamt\Documents\cctv\AI\aihuman` แล้วรันได้ทันที

---

ถ้าต้องการให้ผมปรับแก้ไฟล์ใดเพิ่มเติม (เช่น เพิ่มการบันทึกลง DB, เพิ่ม API endpoint เพื่อสั่ง start/stop จาก backend, หรือปรับให้ใช้ ByteTrack แบบเต็ม) บอกได้เลยครับ ผมจะอัปเดตไฟล์ใน Canvas ให้ทันที.
