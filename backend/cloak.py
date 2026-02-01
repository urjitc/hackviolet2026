"""
Advanced Face Cloaking Module

Two attack modes:
1. FGSM on ResNet - General adversarial noise
2. Face-targeted attack - Specifically breaks face detection (more effective!)

The face-targeted attack adds noise that makes InsightFace unable to detect
the face, which breaks the entire deepfake pipeline.
"""

import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
from typing import Tuple, Optional
import warnings

warnings.filterwarnings("ignore")

# Device setup - use MPS on Mac, CUDA on Linux, CPU as fallback
def get_device():
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")

DEVICE = get_device()
print(f"🔮 Cloaking engine using device: {DEVICE}")

# Lazy load models
_resnet_model = None
_face_app = None

def get_resnet_model():
    """Lazy load the pretrained ResNet model."""
    global _resnet_model
    if _resnet_model is None:
        print("📥 Loading ResNet50 model...")
        _resnet_model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
        _resnet_model.eval()
        _resnet_model.to(DEVICE)
    return _resnet_model


def get_face_app():
    """Lazy load InsightFace for face detection."""
    global _face_app
    if _face_app is None:
        try:
            from insightface.app import FaceAnalysis
            print("📥 Loading InsightFace model...")
            _face_app = FaceAnalysis(providers=['CPUExecutionProvider'])
            _face_app.prepare(ctx_id=0, det_size=(640, 640))
            print("✅ InsightFace loaded")
        except Exception as e:
            print(f"⚠️ InsightFace not available: {e}")
            _face_app = None
    return _face_app


def detect_faces(image: np.ndarray) -> list:
    """Detect faces using InsightFace."""
    app = get_face_app()
    if app is None:
        return []

    try:
        # InsightFace expects BGR
        if len(image.shape) == 3 and image.shape[2] == 3:
            image_bgr = image[:, :, ::-1].copy()
        else:
            image_bgr = image

        faces = app.get(image_bgr)
        return faces
    except Exception as e:
        print(f"Face detection error: {e}")
        return []


def get_transforms(size: int = 512):
    """Get image preprocessing transforms."""
    return transforms.Compose([
        transforms.Resize((size, size)),
        transforms.ToTensor(),
    ])


def tensor_to_pil(tensor: torch.Tensor) -> Image.Image:
    """Convert a tensor back to PIL Image."""
    tensor = tensor.cpu().detach()
    if tensor.dim() == 4:
        tensor = tensor.squeeze(0)

    tensor = torch.clamp(tensor, 0, 1)
    np_image = tensor.permute(1, 2, 0).numpy()
    np_image = (np_image * 255).astype(np.uint8)
    return Image.fromarray(np_image)


def fgsm_attack(
    image: Image.Image,
    epsilon: float = 0.015,
    target_size: int = 512
) -> Tuple[Image.Image, dict]:
    """
    Apply FGSM adversarial attack using ResNet.
    This is the basic attack - works on general image classifiers.
    """
    model = get_resnet_model()
    transform = get_transforms(target_size)
    original_size = image.size

    img_tensor = transform(image).unsqueeze(0).to(DEVICE)
    img_tensor.requires_grad = True

    output = model(img_tensor)
    pred_class = output.argmax(dim=1)
    loss = nn.CrossEntropyLoss()(output, pred_class)

    model.zero_grad()
    loss.backward()

    grad_sign = img_tensor.grad.sign()
    perturbation = epsilon * grad_sign

    cloaked_tensor = img_tensor + perturbation
    cloaked_tensor = torch.clamp(cloaked_tensor, 0, 1)

    cloaked_image = tensor_to_pil(cloaked_tensor)
    cloaked_image = cloaked_image.resize(original_size, Image.Resampling.LANCZOS)

    metadata = {
        "method": "fgsm_resnet",
        "epsilon": epsilon,
        "device": str(DEVICE),
        "perturbation_norm": float(perturbation.abs().mean().item()),
    }

    return cloaked_image, metadata


def create_blend_mask(h: int, w: int, feather: int = 20) -> np.ndarray:
    """
    Create a smooth blending mask with feathered edges.
    1.0 in center, fading to 0.0 at edges.
    """
    mask = np.ones((h, w), dtype=np.float32)

    # Create feathered edges
    for i in range(feather):
        alpha = i / feather
        # Top edge
        if i < h:
            mask[i, :] = min(mask[i, 0], alpha)
        # Bottom edge
        if h - 1 - i >= 0:
            mask[h - 1 - i, :] = np.minimum(mask[h - 1 - i, :], alpha)
        # Left edge
        if i < w:
            mask[:, i] = np.minimum(mask[:, i], alpha)
        # Right edge
        if w - 1 - i >= 0:
            mask[:, w - 1 - i] = np.minimum(mask[:, w - 1 - i], alpha)

    # Expand to 3 channels
    return np.stack([mask, mask, mask], axis=-1)


def create_landmark_mask(h: int, w: int, landmarks: np.ndarray, bbox: np.ndarray, radius: int = 30) -> np.ndarray:
    """Create a mask that's strongest around facial landmarks (eyes, nose, mouth)."""
    mask = np.zeros((h, w), dtype=np.float32)
    x1, y1 = bbox[0], bbox[1]

    # landmarks are in absolute coords, convert to relative to bbox
    for lm in landmarks:
        lx, ly = int(lm[0] - x1), int(lm[1] - y1)
        if 0 <= lx < w and 0 <= ly < h:
            # Create gaussian-like weight around each landmark
            for i in range(max(0, ly - radius), min(h, ly + radius)):
                for j in range(max(0, lx - radius), min(w, lx + radius)):
                    dist = np.sqrt((i - ly) ** 2 + (j - lx) ** 2)
                    if dist < radius:
                        mask[i, j] = max(mask[i, j], 1.0 - (dist / radius))

    # Ensure minimum coverage across face
    mask = np.maximum(mask, 0.2)
    return np.stack([mask, mask, mask], axis=-1)


def face_targeted_attack(
    image: Image.Image,
    epsilon: float = 0.03,
    max_iterations: int = 18,
) -> Tuple[Image.Image, dict]:
    """
    Face-targeted adversarial attack.

    Iteratively adds smooth noise until face detection fails.
    InsightFace threshold is 0.5 - we need to push confidence below that.
    """
    original_size = image.size
    img_array = np.array(image)

    faces = detect_faces(img_array)

    if len(faces) == 0:
        print("⚠️ No face detected, using FGSM fallback")
        return fgsm_attack(image, epsilon=epsilon)

    initial_conf = faces[0].det_score if hasattr(faces[0], 'det_score') else 1.0
    print(f"🎯 Found {len(faces)} face(s), confidence={initial_conf:.3f} (threshold=0.5)")

    img_float = img_array.astype(np.float32) / 255.0
    result_float = img_float.copy()

    for face in faces:
        bbox = face.bbox.astype(int)
        x1, y1, x2, y2 = bbox

        pad = int((x2 - x1) * 0.15)
        x1 = max(0, x1 - pad)
        y1 = max(0, y1 - pad)
        x2 = min(img_array.shape[1], x2 + pad)
        y2 = min(img_array.shape[0], y2 + pad)

        face_region = img_float[y1:y2, x1:x2].copy()
        original_face = face_region.copy()
        h, w = face_region.shape[:2]

        # Smooth elliptical mask
        y_coords, x_coords = np.ogrid[:h, :w]
        center_y, center_x = h / 2, w / 2
        dist = np.sqrt(((y_coords - center_y) / (h / 2)) ** 2 + ((x_coords - center_x) / (w / 2)) ** 2)
        smooth_mask = np.clip(1.0 - dist * 0.6, 0, 1) ** 2
        smooth_mask = np.stack([smooth_mask, smooth_mask, smooth_mask], axis=-1)

        cumulative_noise = np.zeros_like(face_region)
        noise_scale = epsilon * 0.3

        for iteration in range(max_iterations):
            noise = np.random.randn(h, w, 3).astype(np.float32) * noise_scale * smooth_mask
            cumulative_noise += noise

            noised_face = original_face + cumulative_noise
            noised_face = np.clip(noised_face, 0, 1)

            test_img = img_float.copy()
            test_img[y1:y2, x1:x2] = noised_face
            test_array = (test_img * 255).astype(np.uint8)
            test_faces = detect_faces(test_array)

            if len(test_faces) == 0:
                actual_eps = np.abs(cumulative_noise).max()
                print(f"  ✅ Undetectable after {iteration+1} iters (noise={actual_eps:.3f})")
                face_region = noised_face
                break

            noise_scale *= 1.2
        else:
            face_region = noised_face
            conf = test_faces[0].det_score if test_faces else 0
            print(f"  ⚠️ Max iters, conf={conf:.3f}")

        result_float[y1:y2, x1:x2] = face_region

    img_float = result_float

    # Convert back to uint8
    cloaked_array = (img_float * 255).astype(np.uint8)
    cloaked_image = Image.fromarray(cloaked_array)

    # Verify final result
    final_faces = detect_faces(cloaked_array)
    protection_successful = len(final_faces) == 0

    metadata = {
        "method": "face_targeted",
        "epsilon": epsilon,
        "faces_detected_before": len(faces),
        "faces_detected_after": len(final_faces),
        "protection_successful": protection_successful,
    }

    if protection_successful:
        print("🛡️ Face successfully cloaked - undetectable!")
    else:
        print(f"⚠️ Face still detectable ({len(final_faces)} faces) - applying extra noise...")
        # Apply additional FGSM on top for extra protection
        cloaked_image, extra_meta = fgsm_attack(cloaked_image, epsilon=epsilon * 0.5)
        metadata["extra_fgsm_applied"] = True

    return cloaked_image, metadata


def cloak_image(
    image: Image.Image,
    strength: str = "medium",
    method: str = "auto"
) -> Tuple[Image.Image, dict]:
    """
    High-level cloaking function.

    Args:
        image: Input PIL Image
        strength: "light", "medium", "strong"
        method: "auto", "face", or "fgsm"
                - auto: Use face-targeted if face detected, else FGSM
                - face: Force face-targeted attack
                - fgsm: Force FGSM (faster but less effective)

    Returns:
        Tuple of (cloaked_image, metadata)
    """
    epsilon_map = {
        "light": 0.01,
        "medium": 0.02,
        "strong": 0.03,
    }
    epsilon = epsilon_map.get(strength, 0.02)

    if method == "fgsm":
        return fgsm_attack(image, epsilon=epsilon)

    elif method == "face":
        return face_targeted_attack(image, epsilon=epsilon)

    else:  # auto
        # Check if there's a face to target
        img_array = np.array(image)
        faces = detect_faces(img_array)

        if len(faces) > 0:
            print(f"🎯 Auto-detected {len(faces)} face(s), using face-targeted attack")
            return face_targeted_attack(image, epsilon=epsilon)
        else:
            print("📷 No face detected, using FGSM attack")
            return fgsm_attack(image, epsilon=epsilon)


# Quick test
if __name__ == "__main__":
    test_img = Image.new("RGB", (256, 256), color="red")
    cloaked, meta = cloak_image(test_img)
    print(f"✅ Cloaking test passed! Metadata: {meta}")
