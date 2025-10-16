@echo off
python "C:\Users\chayaphonlamt\Documents\cctv\AI\aicar\evaluate_from_mot.py" --config "C:\Users\chayaphonlamt\Documents\cctv\config.yaml" --camera "_camera_3" --mot "C:\Users\chayaphonlamt\Documents\cctv\AI\aicar\runs\car_parking_monitor_multi_cam\_camera_3\mot_results\mot.txt" --fps 25 > results__camera__3.json

python "C:\Users\chayaphonlamt\Documents\cctv\AI\aicar\evaluate_from_mot.py" --config "C:\Users\chayaphonlamt\Documents\cctv\config.yaml" --camera "camera_1" --mot "C:\Users\chayaphonlamt\Documents\cctv\AI\aicar\runs\car_parking_monitor_multi_cam\camera_1\mot_results\mot.txt" --fps 25 > results__camera_1.json

python "C:\Users\chayaphonlamt\Documents\cctv\AI\aicar\evaluate_from_mot.py" --config "C:\Users\chayaphonlamt\Documents\cctv\config.yaml" --camera "camera_2" --mot "C:\Users\chayaphonlamt\Documents\cctv\AI\aicar\runs\car_parking_monitor_multi_cam\camera_2\mot_results\mot.txt" --fps 25 > results__camera_2.json

pause
