from detectors.yolo_processor import YoloV8Strategy

def get_yolo_inferer(yolo_model_path):
    """
    Returns the appropriate YOLO inference strategy based on the model path.
    Args:
        yolo_model_path (Path): Path to the YOLO model file.
    Returns:
        class: A YOLO strategy class (e.g., YoloV8Strategy).
    """
    # Check for YOLOv8 models (e.g., yolov8n.pt, yolov8s.pt, etc.)
    if "yolov8" in str(yolo_model_path).lower():
        return YoloV8Strategy
    # Add more strategies here if you plan to support other YOLO versions (e.g., YOLOv5)
    # elif "yolov5" in str(yolo_model_path).lower():
    #    return YoloV5Strategy # You'd need to define YoloV5Strategy
    else:
        raise ValueError(f"Unsupported YOLO model type: {yolo_model_path}")