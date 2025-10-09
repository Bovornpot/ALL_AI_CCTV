from pathlib import Path
from evaluation import evaluate_all_cameras

config_yaml = Path("..") / "config.yaml"  # ../config.yaml เพราะคุณอยู่ในโฟลเดอร์ AI
output_dir = Path("evaluation_logs")

evaluate_all_cameras(config_yaml, output_dir)
