AI CCTV Prototype

โปรเจกต์ต้นแบบ AI CCTV นี้มีเป้าหมายเพื่อพัฒนาระบบเฝ้าระวังอัจฉริยะที่สามารถประมวลผลข้อมูลวิดีโอจากกล้อง IP เพื่อวิเคราะห์ข้อมูลเชิงลึก เช่น การนับจำนวนคน, การประมาณเพศและอายุ, และการสร้าง Heatmap ระบบจะถูกออกแบบมาให้สามารถทำงานได้ทั้งบน Edge Device (สำหรับประมวลผลแบบเรียลไทม์ใกล้แหล่งกำเนิดข้อมูล) และเชื่อมต่อกับ Backend/Frontend บน Cloud/Server เพื่อการจัดเก็บและแสดงผลข้อมูล

Phase1: AI CCTV Prototype - Initial Setup & Camera Capture 

1.Project Structure Overview
```
ai_cctv_prototype/
├── venv/                   # สภาพแวดล้อมเสมือนของ Python (Python Virtual Environment)
├── .gitignore              # ไฟล์กำหนดรายการที่ Git จะไม่ติดตาม (Git Ignore File)
├── README.md               # เอกสารประกอบโปรเจกต์ (Project Documentation)
├── docker-compose.yml      # (ในอนาคต) ไฟล์สำหรับจัดการและรัน Docker หลายคอนเทนเนอร์ (Docker Orchestration)
├── docs/                   # เอกสารประกอบโปรเจกต์ทั่วไป (General Project Documentation)
│
├── backend/                # ส่วนของ Backend API (FastAPI)
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py                     # Dependencies ที่ใช้กับ FastAPI (เช่น get_db, verify_api_key)
│   │   │   └── routers/                    # เก็บไฟล์ route ของแต่ละ feature (จัดเป็น modular structure)
│   │   │       ├── parking.py              # Route สำหรับจัดการ Parking Violations เช่น GET/POST ข้อมูล
│   │   │       ├── table.py                # Route สำหรับจัดการ Table Occupancy
│   │   │       ├── chilled.py              # Route สำหรับจัดการ Chilled Basket Alerts
│   │   │       └── analytics.py            # Route สำหรับรับข้อมูล inference ผลลัพธ์จาก AI (entry point หลักจาก AI pipeline)
│   │   ├── core/
│   │   │   └── config.py                   # การตั้งค่า configuration (อาจรวม env variables, secret, ฯลฯ)       
│   │   ├── __init__.py     # ไฟล์เริ่มต้นของ Python package
│   │   ├── main.py         # แอปพลิเคชัน FastAPI หลัก
│   │   ├── database.py     # การเชื่อมต่อฐานข้อมูล, ORM models, สร้าง tables
│   │   └── schemas.py      # Pydantic schemas สำหรับ validate และ serialize/deserialize data
│   └── requirements.txt    # รายการแพ็คเกจ Python ที่จำเป็นสำหรับ Backend
│
├──frontend/
│    ├── public/                 # โฟลเดอร์สำหรับทรัพยากรสถิตย์ (Static Assets) ที่จะถูกเสิร์ฟโดยตรง
│    │   ├── index.html          # ไฟล์ HTML หลักที่ React Application ของคุณจะถูก Render เข้าไป
│    │   ├── favicon.ico         # ไอคอน Favicon ของเว็บที่แสดงบนแท็บเบราว์เซอร์
│    │   └── ai-cctv-logo.svg    # โลโก้สำหรับ Header ของแอปพลิเคชัน
│
│    ├── src/                    # โฟลเดอร์หลักสำหรับ Source Code ของ React Application
│    │   ├── api/                # สำหรับ Logic ในการเรียกใช้ Backend API หรือ Mock Data
│    │   │   ├── analytics.ts    # ไฟล์ที่รวมฟังก์ชันสำหรับดึงข้อมูล Dashboard (ปัจจุบันใช้ Mock Data)
│    │   │   └── mockParkingData.ts    # ไฟล์ที่รวมฟังก์ชันสำหรับดึงข้อมูล Dashboard (ปัจจุบันใช้ Mock Data)
│    │   │
│    │   ├── assets/             # (Optional) โฟลเดอร์สำหรับเก็บรูปภาพ, ไอคอน, ฟอนต์ หรือไฟล์ Media อื่นๆ ที่ใช้ใน UI
│    │   │   └── icons/          # ตัวอย่างโฟลเดอร์สำหรับไอคอน (ปัจจุบันใช้ Lucide React เป็นหลัก)
│    │   │       └── sidebar/
│    │   │
│    │   ├── components/         # โฟลเดอร์สำหรับ UI Components ที่นำมาใช้ซ้ำได้ (Reusable Components)
│    │   │   ├── common/         # Components ทั่วไปที่ใช้ได้หลายที่ เช่น ปุ่ม, การ์ดพื้นฐาน
│    │   │   │   ├── StatCard.tsx     # การ์ดแสดงตัวเลขสถิติ (ปรับขนาด font และ padding ให้เล็กลง)
│    │   │   │   ├── AlertCard.tsx    # การ์ดแสดงข้อมูล Alert (สาขาที่มี Alerts สูงสุด) (ปรับการจัดวางและขนาด font)
│    │   │   │   ├── SectionCard.tsx  # การ์ดสำหรับ Section ต่างๆ ใน Dashboard (มี Title และ Status)
│    │   │   │   └── ParkingAlertCard.tsx  # การ์ดสำหรับ Section ต่างๆ ใน Parking Violation Detail 
│    │   │   │
│    │   │   ├── layout/         # Components ที่ใช้ในการจัดวางโครงสร้าง Layout ของหน้าจอหลัก
│    │   │   │   ├── Header.tsx     # ส่วนหัวของ Dashboard (โลโก้, ชื่อแอป, Date/Branch/Search Controls)
│    │   │   │   ├── Header.css     # CSS สำหรับ Header (ปรับความสูงและจัดวางองค์ประกอบ)
│    │   │   │   ├── MainLayout.tsx # Component หลักที่รวม Header, Sidebar และ Content Area (แสดง Dynamic Title)
│    │   │   │   ├── MainLayout.css # CSS สำหรับ MainLayout (ปรับ margin-top และ padding ของ content)
│    │   │   │   ├── Sidebar.tsx    # แถบนำทางด้านซ้ายมือ (เมนูหลักและโปรไฟล์ผู้ใช้)
│    │   │   │   └── Sidebar.css    # CSS สำหรับ Sidebar
│    │   │   │
│    │   │   ├── widgets/        # โฟลเดอร์สำหรับ Component ของแต่ละ Widget บน Dashboard
│    │   │   │   ├── OverallSystemPerformanceWidget.tsx # Widget แสดงภาพรวมระบบและประสิทธิภาพ (มีกราฟ Line Chart)
│    │   │   │   ├── TopBranchesByAlertsWidget.tsx      # Widget แสดงสาขาที่มี Alerts สูงสุด (ใช้ AlertCard)
│    │   │   │   ├── ParkingViolationWidget.tsx         # Widget แสดงข้อมูลการละเมิดจอดรถ (มี StatCard, รายการ, Line Chart)
│    │   │   │   ├── TableOccupancyWidget.tsx           # Widget แสดงข้อมูลการใช้โต๊ะ (มี StatCard, ข้อความ, Bar Chart)
│    │   │   │   └── ChilledBasketAlertWidget.tsx       # Widget แสดงข้อมูลแจ้งเตือนตะกร้าแช่เย็น (มี StatCard, รายการ, Bar Chart)
│    │   │   │
|    |   |   └── parking/
│    │   │       ├── KpiCards.tsx               # แสดงชุดการ์ด KPI สรุปสถิติการละเมิดจอดรถ เช่น จำนวนเหตุการณ์ เวลาละเมิดเฉลี่ย และเวลาจอดรถปกติ
│    │   │       ├── TopBranchesList.tsx        # แสดงรายการสาขาที่มีการละเมิดจอดรถสูงสุด พร้อมแสดงลำดับและจำนวนการละเมิดในรูปแบบรายการที่คลิกได้
│    │   │       ├── ViolationsChart.tsx        # แสดงกราฟแท่ง (Bar Chart) แสดงจำนวนการละเมิดจอดรถในแต่ละช่วงหรือแต่ละสาขา เพื่อวิเคราะห์แนวโน้มและเปรียบเทียบข้อมูล
│    │   │       ├── ViolationsTable.css        # สไตล์ CSS สำหรับตารางแสดงรายละเอียดการละเมิดจอดรถ รวมถึงการจัดรูปแบบตาราง, hover effect และแถบแสดงสถานะ (Status Badge)
│    │   │       └── ViolationsTable.tsx        # ตารางแสดงรายละเอียดเหตุการณ์ละเมิดจอดรถ พร้อมฟังก์ชันกรองข้อมูลตามสถานะ (Violation / All) และแสดงสถานะด้วย Badge สีต่าง ๆ
│    │   │
│    │   ├── contexts/           # (ถ้าจำเป็น) สำหรับ React Context API เพื่อจัดการ Global State ที่ซับซ้อน
│    │   │
│    │   ├── hooks/              # สำหรับ Custom React Hooks ที่นำมาใช้ซ้ำได้ (เช่น useFetchData)
│    │   │
│    │   ├── pages/              # สำหรับ Component ของหน้าจอหลักแต่ละหน้า
│    │   │   ├── DashboardOverviewPage.tsx # หน้าจอ Dashboard Overview หลัก (จัดวาง Widgets ด้วย Grid, ลด gap)
│    │   │   └── ParkingViolationDetailsPage.tsx # หน้ารายละเอียด Parking Violation  
│    │   │
│    │   ├── styles/             # (Optional) ไฟล์ CSS/SCSS ทั่วไป, Global Styles, หรือ Themes (นอกเหนือจาก index.css)
│    │   │   └── global.css 
│    │   │
│    │   ├── types/              # ฟังก์ชัน Helper ต่างๆ ที่ใช้ทั่วโปรเจกต์
│    │   │   ├── parkingViolation.ts    # กำหนดชนิดข้อมูล (TypeScript types/interfaces) ที่เกี่ยวข้องกับการละเมิดจอดรถ เช่น สถานะเหตุการณ์, โครงสร้างข้อมูลเหตุการณ์ละเมิด 
│    │   │   └── time.ts    # กำหนดชนิดข้อมูลสำหรับการเลือกช่วงเวลา (Day, Week, Month) ทั้งแบบsingle หรือ range เพื่อใช้ในการกรองข้อมูลตามเวลา
│    │   │
│    │   ├── utils/              # ฟังก์ชัน Helper ต่างๆ ที่ใช้ทั่วโปรเจกต์
│    │   │   └── dateUtils.ts    # ฟังก์ชันช่วยในการจัดการและจัดรูปแบบวันที่/เวลา (เพิ่ม Logic 'สัปดาห์นี้'/'เดือนนี้')
│    │   │
│    │   ├── App.tsx             # Component หลักของแอปพลิเคชัน ทำหน้าที่จัดการ Routing (React Router DOM) และ State หลัก (Date, Tab)
│    │   ├── index.tsx           # จุดเริ่มต้นของการ Render React App เข้าไปใน index.html (ไม่ค่อยมีการแก้ไข)
│    │   ├── index.css           # Global CSS ที่ Import Tailwind CSS directives และ Global Styles อื่นๆ
│    │   └── react-app-env.d.ts  # TypeScript environment definitions สำหรับ Create React App
│    │
│    ├── node_modules/           # โฟลเดอร์ที่เก็บ Node.js Packages (Dependencies) ทั้งหมดที่ติดตั้งไว้
│    ├── .env                    # ไฟล์สำหรับเก็บ Environment Variables (เช่น URL ของ Backend API)
│    ├── .gitignore              # ไฟล์กำหนดรายการที่ Git จะไม่ติดตาม (เช่น node_modules, .env)
│    ├── package.json            # ไฟล์ตั้งค่าโปรเจกต์ Node.js, กำหนด Dependencies และ Scripts คำสั่ง (npm start, build)
│    ├── package-lock.json       # ไฟล์ที่ล็อกเวอร์ชันของแพ็คเกจที่ติดตั้งไว้ เพื่อให้มั่นใจว่าทุกคนใช้เวอร์ชันเดียวกัน
│    ├── tsconfig.json           # ไฟล์ตั้งค่า TypeScript Compiler
│    ├── tailwind.config.js      # ไฟล์ตั้งค่าสำหรับ Tailwind CSS (กำหนด Path ของไฟล์ที่จะ Scan หา Tailwind Classes)
│    ├── postcss.config.js       # ไฟล์ตั้งค่าสำหรับ PostCSS (กำหนด Plugins เช่น Tailwind CSS และ Autoprefixer)
│    └── README.md               # เอกสารประกอบโปรเจกต์ Frontend, วิธี Setup และ Run
│
├── inference_runtime/      # ส่วนสำหรับรัน AI Inference และจัดการ Data Ingestion Pipeline (จำลอง Edge Device)
│   ├── camera_capture/     # สคริปต์สำหรับการจับภาพวิดีโอ/เฟรม
│   │   └── rtsp_capture.py # ตัวอย่างสคริปต์สำหรับการจับภาพวิดีโอจาก RTSP
│   ├── inference_wrapper/  # สคริปต์สำหรับโหลดและรัน AI model
│   │   ├── __init__.py     # ไฟล์เริ่มต้นของ Python package
│   │   └── mock_ai_inference.py # สคริปต์สำหรับสร้างข้อมูล Mock AI Inference
│   ├── configs/            # ไฟล์การตั้งค่า (เช่น การตั้งค่ากล้อง)
│   ├── models/             # (AI Engineer จะวางไฟล์ AI model ที่นี่)
│   └── run_pipeline.py     # สคริปต์หลักสำหรับรัน mock inference pipeline
│
├── ai_development/         # ส่วนสำหรับการพัฒนาและฝึกฝน AI Model
│   ├── datasets/           # ชุดข้อมูลสำหรับฝึกฝน/ประเมินผล
│   ├── models/             # AI model ที่ฝึกฝนแล้ว (เวอร์ชันสำหรับการพัฒนา)
│   ├── notebooks/          # Jupyter notebooks สำหรับการทดลอง
│   └── scripts/            # สคริปต์การฝึกฝน/ประเมินผล AI
│
└── data/                   # ข้อมูลที่ไม่ถูก Commit เข้า Git (เช่น SQLite DB, logs)
    ├── db.sqlite           # ไฟล์ฐานข้อมูล SQLite (สร้างโดย Backend)
    └── logs/               # ไฟล์ Log
```

2.Environment Setup
    2.1) Prerequisites
        - Python 3.10.11
        - Node.js & npm
        - Git
    2.2) Installing
        1.โคลน Repository
            git clone https://github.com/Bovornpot/ai_cctv_prototype.git

        2.ตั้งค่า Git User
            git config --global user.name "Bovornpot"
            git config --global user.email "bovornpot5861@gmail.com"
        
        3.สร้างและ Activate Python Virtual Environment
            python -m venv venv # สำหรับ Windows
        
        4.ติดตั้ง Python Dependencies สำหรับส่วนต่างๆ
            - สำหรับ inference_runtime (Camera Capture): 
                pip install opencv-python-headless opencv-python 

            - สำหรับ backend (FastAPI/Flask)
                pip install fastapi uvicorn pandas numpy

        5.ติดตั้ง Node.js Dependencies สำหรับ frontend:
            cd frontend
            npm install     

3.Video Capture (Test)
    ใน Week แรก ยังไม่ได้ใช้การดึง Live IP Camera แต่ใช้ วิดีโอแทน
    3.1) เตรียมไฟล์วิดีโอ นามสกุล .mp4

    3.2) rtsp_capture.py: เปิดไฟล์ inference_runtime/camera_capture/rtsp_capture.py และเปลี่ยนค่า rtsp_url ให้เป็น Path ของไฟล์วิดีโอ หรือเป็น RTSP URL ของกล้อง IP
            # ตัวอย่างการใช้ไฟล์วิดีโอ
             rtsp_url = r"C:\Users\bovornpotpua\Desktop\example.mp4"

            # ตัวอย่างการใช้ Live Stream จากกล้อง
             rtsp_url = "rtsp://<username>:<password>@<camera_ip_address>:<port>/<stream_path>" 

    3.3) รันสคริปต์: ตรวจสอบให้แน่ใจว่าคุณอยู่ใน Python Virtual Environment ((venv) นำหน้า Command Prompt) แล้วรันคำสั่ง:
            python inference_runtime/camera_capture/rtsp_capture.py

(Phase1 -> start 09/06/2056 - finish 09/06/2025)

Phase 2: การจำลอง AI Inference, Backend API

    1. การนิยามโครงสร้างข้อมูล (Output JSON Schema)
        เราได้กำหนดรูปแบบมาตรฐานของข้อมูลผลลัพธ์จาก AI Inference โดยใช้ Pydantic Models ในไฟล์ backend/app/schemas.py ซึ่งทำหน้าที่เป็น "สัญญาข้อมูล" เพื่อให้แน่ใจว่าข้อมูลที่ถูกส่งและรับในระบบมีรูปแบบที่ถูกต้องและสอดคล้องกัน
        - ไฟล์: backend/app/schemas.py
        - ประโยชน์: ช่วยให้ FastAPI สามารถตรวจสอบความถูกต้องของข้อมูลขาเข้าและสร้างเอกสาร API ได้โดยอัตโนมัติ

    2. Mock AI Inference Script (การจำลองผลลัพธ์ AI)
        เราได้สร้างสคริปต์จำลองในไฟล์ inference_runtime/inference_wrapper/mock_ai_inference.py ที่สร้างข้อมูลผลลัพธ์การวิเคราะห์ AI แบบสุ่ม (เช่น จำนวนคน, ตำแหน่งการตรวจจับ, ID กล้อง) ในรูปแบบ JSON
        - ไฟล์: inference_runtime/inference_wrapper/mock_ai_inference.py
        - ประโยชน์: ใช้สำหรับพัฒนาและทดสอบระบบ Backend โดยไม่ต้องพึ่งพา AI Model หรือฮาร์ดแวร์จริง ทำให้การพัฒนาเป็นไปอย่างรวดเร็ว

    3. Database Module (SQLite)
        เราได้พัฒนาโมดูลสำหรับการจัดการฐานข้อมูลโดยใช้ SQLite ในไฟล์ backend/app/database.py ซึ่งเป็นฐานข้อมูลแบบไฟล์เดียวที่เหมาะสำหรับโปรเจกต์ต้นแบบและ Edge Device
        - ไฟล์: backend/app/database.py
        - ความสามารถ: 
            จัดการการเชื่อมต่อกับฐานข้อมูล data/db.sqlite
            สร้างตาราง inference_results เพื่อจัดเก็บข้อมูลการวิเคราะห์ AI
            ฟังก์ชันสำหรับบันทึก (Insert) ผลลัพธ์ AI ใหม่
            ฟังก์ชันสำหรับดึง (Retrieve) ผลลัพธ์ AI ล่าสุด หรือกรองตาม ID กล้อง

    4. FastAPI Application (Backend API)
        เราได้สร้างหัวใจหลักของระบบ Backend ด้วย FastAPI ในไฟล์ backend/app/main.py ซึ่งทำหน้าที่เป็นจุดรับและส่งข้อมูลหลักของระบบ
        - ไฟล์: backend/app/main.py
        - ความสามารถ:
            - CORS Middleware: อนุญาตให้ Frontend สามารถเรียกใช้ API ได้อย่างปลอดภัย
            - Startup Event: สร้างโฟลเดอร์ data และตรวจสอบ/สร้างตารางฐานข้อมูลโดยอัตโนมัติเมื่อ API เริ่มทำงาน
            - Health Check Endpoint (/health): สำหรับตรวจสอบสถานะการทำงานของ API
            - POST Endpoint (/inference_results/):
                - รับข้อมูลผลลัพธ์ AI จาก Edge Device (จำลองโดย mock_ai_inference.py)
                - ใช้ Pydantic เพื่อ Validate ข้อมูลขาเข้า โดยอัตโนมัติ
                - จัดเก็บข้อมูลลงในฐานข้อมูลผ่าน database.py
            - GET Endpoint (/inference_results/):
                - ดึงข้อมูลผลลัพธ์ AI ล่าสุดจากฐานข้อมูล
                - รองรับการกรองตาม camera_id และการจำกัดจำนวนผลลัพธ์ (limit)
            - Interactive API Documentation: FastAPI สร้างเอกสาร API (Swagger UI) ที่ http://127.0.0.1:8000/docs โดยอัตโนมัติ ทำให้คุณสามารถสำรวจและทดสอบ API ได้อย่างง่ายดาย
    (10/06/2056)

    5. Mock AI Inference Pipeline (การเชื่อมต่อและส่งข้อมูล)
        เราได้พัฒนาสคริปต์ run_pipeline.py เพื่อจำลองการทำงานของ Edge Device ที่จะสร้างข้อมูล AI Inference และส่งไปยัง Backend API อย่างต่อเนื่อง
        - ไฟล์: inference_runtime/run_pipeline.py
        - ความสามารถ:
            - เรียกใช้ mock_ai_inference.py เพื่อ สร้างข้อมูลจำลอง
            - ใช้ไลบรารี requests เพื่อส่ง HTTP POST Request ที่มีข้อมูล JSON Payload ไปยัง POST /inference_results/ Endpoint ของ Backend API
            - สามารถจำลองการทำงานของ กล้องหลายตัวพร้อมกัน โดยใช้ threading
            - มีกลไกจัดการข้อผิดพลาดพื้นฐาน เช่น การเชื่อมต่อกับ Backend ไม่ได้
        - สถานะปัจจุบัน: ณ ตอนนี้ Pipeline นี้สามารถทำงานได้และส่งข้อมูลจำลองไปยัง Backend API ซึ่งจะถูกจัดเก็บลงในฐานข้อมูล SQLite โดยอัตโนมัติ ทำให้ระบบ End-to-End (ในส่วนของ Backend และ Data Ingestion) ทำงานได้อย่างสมบูรณ์

    How to Run and Test 
        1. การ Set up
            1.1 โคลน Project: หากยังไม่ได้ทำ ให้โคลน Repository นี้:
                    git clone [Your Repository URL]
                    cd ai_cctv_prototype

            1.2 สร้างและ Activate Virtual Environment:
                    python -m venv venv
                    # บน Windows:
                    venv\Scripts\activate
                    # บน Linux/macOS:
                    source venv/bin/activate

            1.3 ติดตั้ง Dependencies: สร้างไฟล์ requirements.txt ในโฟลเดอร์ backend
                    pip install -r backend/requirements.txt

        2. รัน FastAPI Backend
            เปิด Terminal หน้าต่างที่ 1 และทำตามขั้นตอน:
            2.1 ตรวจสอบให้แน่ใจว่าคุณอยู่ใน Root ของโปรเจกต์ (ai_cctv_prototype) และ activate virtual environment แล้ว

            2.2 เปลี่ยน Directory ไปที่โฟลเดอร์ backend:
                    cd backend
            
            2.3 รัน FastAPI Server:
                    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

                - คุณจะเห็นข้อความ INFO: Uvicorn running on http://0.0.0.0:8000 และ Database tables ensured and ready.
                - ปล่อย Terminal นี้ทิ้งไว้ ให้ Server ทำงานอยู่เบื้องหลัง

        3. รัน Mock Inference Pipeline
            เปิด Terminal หน้าต่างที่ 2 (ใหม่) และทำตามขั้นตอน:
            3.1 ตรวจสอบให้แน่ใจว่าคุณอยู่ใน Root ของโปรเจกต์ (ai_cctv_prototype) และ activate virtual environment แล้ว
                - สำคัญ: ถ้าคุณได้เพิ่มโค้ด sys.path.append(...) ใน inference_runtime/run_pipeline.py ให้แน่ใจว่าบรรทัด PATH_TO_PROJECT_ROOT ถูกต้องตามที่แนะนำล่าสุด (os.path.join(os.path.dirname(__file__), ".."))
            
            3.2 รันสคริปต์ run_pipeline.py
                    python inference_runtime/run_pipeline.py

                -คุณจะเห็นข้อความแสดงว่า Pipeline กำลังเริ่มต้นและมีการส่งข้อมูลจากแต่ละ camera_id ไปยัง Backend API อย่างต่อเนื่อง

        4. ตรวจสอบผลลัพธ์
            ในขณะที่ทั้งสอง Terminal กำลังทำงานอยู่:
            4.1 ตรวจสอบ FastAPI Backend Log (Terminal หน้าต่างที่ 1):
                    - คุณควรเห็นข้อความ INFO: 127.0.0.1:xxxxx - "POST /inference_results/ HTTP/1.1" 201 Created ปรากฏขึ้นมาอย่างต่อเนื่อง ซึ่งยืนยันว่า FastAPI กำลังรับข้อมูล
            4.2 ตรวจสอบข้อมูลในฐานข้อมูล (ผ่าน Swagger UI):
                    - เปิดเว็บเบราว์เซอร์ของคุณ
                    - ไปที่ URL: http://127.0.0.1:8000/docs
                    - ใน Swagger UI ให้หา GET /inference_results/
                    - คลิก "Try it out" และคลิก "Execute"
                    - คุณจะเห็นข้อมูล AI Inference ที่ถูกส่งมาจาก run_pipeline.py และบันทึกลงในฐานข้อมูล ปรากฏเป็น JSON Array ใน Response Body ซึ่งมีการอัปเดตเรื่อยๆ

(Phase2 -> start 10/06/2056 - finish 11/06/2025)

Phase 3: Frontend Dashboard

                



            


            



    