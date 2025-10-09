import torch
import numpy as np

class Yolo:
    def __init__(self, yolo_strategy):
        self.yolo_strategy = yolo_strategy

    def inference(self, im):
        """Performs inference using the selected YOLO strategy."""
        return self.yolo_strategy.inference(im)

    def postprocess(self, path, preds, im, im0s, predictor):
        """Performs post-processing using the selected YOLO strategy."""
        return self.yolo_strategy.postprocess(path, preds, im, im0s, predictor)

class YoloV8Strategy:
    def __init__(self, model, device, args):
        self.model = model
        self.device = device
        self.args = args

    def inference(self, im):
        # im is already preprocessed by ultralytics predictor
        return self.model(im, augment=self.args.augment, visualize=False)

    def postprocess(self, path, preds, im, im0s, predictor):
        """Post-process predictions from YOLOv8 model."""
        # This part largely mirrors ultralytics' own postprocess logic
        # It takes raw model outputs and converts them into a usable Results object
        
        # Ensure preds is a list (even if single image)
        if not isinstance(preds, list):
            preds = [preds]

        results = []
        for i, pred in enumerate(preds):
            # For detection models, pred shape is usually (N, 6) where N is detections, 6 is [x1,y1,x2,y2,conf,cls]
            # or for segment/pose it's more complex.
            # We need to ensure it's on CPU for further processing if it's on GPU
            if isinstance(pred, torch.Tensor):
                pred = pred.cpu().numpy() # Convert to numpy on CPU
            
            # Here, we assume the input `preds` from `self.model(im)` is already processed
            # to be similar to what `predictor.postprocess` expects,
            # or directly contains the detection tensors ready for BoxMOT's `update`.
            # For simplicity, if `preds` directly contains `Results` objects (which it does from `predictor.model(im)` in `run`),
            # we can just return that.
            
            # The `preds` argument to this method usually comes directly from the model's forward pass.
            # In `track_cars.py`, `preds = model.inference(im)` which returns the raw output
            # from the YOLOv8 model. The `predictor.postprocess` then converts this into
            # `ultralytics.yolo.engine.results.Results` objects.
            
            # So, for this `yolo_processor.py` to be truly decoupled, it needs to replicate
            # parts of `ultralytics.yolo.engine.predictor.Predictor.postprocess`.
            # However, for the provided `track_cars.py`, the flow is:
            # `preds = model.inference(im)` (raw output)
            # `predictor.results = model.postprocess(..., preds, ...)` (this line)
            # This means `model.postprocess` here *should* return the `Results` object.
            
            # A more direct approach to get the detections tensor for BoxMOT:
            # If `preds` is the raw output from `self.model(im)` (the YOLOv8 model),
            # then the actual `Results` object is often returned by the main `YOLO` object's `predict` method.
            # Let's adjust `track_cars.py` to call `predictor.postprocess` directly,
            # and this `YoloV8Strategy.postprocess` can be simpler or removed if it's redundant.

            # Re-evaluating the original `track_cars.py` and BoxMOT's structure:
            # BoxMOT's `Yolo` wrapper (like the one here) usually *performs* the postprocessing
            # to get the `dets` array ([x1,y1,x2,y2,conf,cls]) directly.
            # So, this `postprocess` method should return the `dets` array.

            # This is how `ultralytics` gets `dets` from `preds`:
            # For YOLOv8 detection:
            # `pred` here is likely `[batch_size, num_boxes, 6]` or similar
            # where the last dimension is `[xyxy, conf, cls]`
            
            # Let's assume `preds` here are the raw `torch.Tensor` outputs from `model(im)`
            # and we need to convert them to `Results` object (or `dets` array)
            # This can be complex to replicate fully from `ultralytics` without importing their internal functions.

            # Given the previous `track_cars.py` was calling `predictor.results = model.postprocess(...)`
            # and `predictor.results[0].boxes.data` was used, it implies `model.postprocess`
            # needs to return an object that has `[0].boxes.data`.
            # The easiest way to achieve this is to let `ultralytics` do its job.

            # Let's simplify this `postprocess` to just return what BoxMOT needs
            # which is the detections tensor.
            # The `predictor.results` and `predictor.postprocess` in `track_cars.py`
            # should handle the creation of the `Results` object.
            # So, this `postprocess` in `YoloV8Strategy` should probably just return `preds` as is,
            # or extract the detection data if `preds` is a complex object.

            # For the purpose of getting `dets = predictor.results[0].boxes.data` to work:
            # `predictor.results` is a list of `Results` objects.
            # So, `model.postprocess` in `track_cars.py` should return a list of `Results` objects.
            
            # Simplest correct approach: rely on Ultralytics' own postprocessing.
            # This `YoloV8Strategy` doesn't need to do complex postprocessing;
            # it should just pass the raw predictions.
            # The `predictor.postprocess` in `track_cars.py` will then correctly format it.
            
            # Therefore, this `postprocess` method is largely redundant if `predictor.postprocess`
            # (which is an ultralytics function) is called next.
            # The `model.postprocess` call in `track_cars.py` needs `im`, `im0s` and `predictor`.
            # So, `Yolo` class's `postprocess` method should just pass these to `predictor.postprocess`.
            
            return predictor.postprocess(path, preds, im, im0s, predictor)
            
        return results # Should not reach here