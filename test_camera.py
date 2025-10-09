import cv2

rtsp_url = r"rtsp://adminhq:admin1@2@112.131.146.9:554/cam/realmonitor?channel=1&subtype=0"


cap = cv2.VideoCapture(rtsp_url)

if not cap.isOpened():
    print(f"Error: Could not open video stream from {rtsp_url}")
    exit()

print("Successfully connected to RTSP stream. Press 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame or stream ended.")
        break

    cv2.imshow('RTSP Live Stream', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("Stream ended.")