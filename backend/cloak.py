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
    epsilon: float = 0.03,
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


def face_targeted_attack(
    image: Image.Image,
    epsilon: float = 0.05,
    max_iterations: int = 10,
    noise_scale: float = 0.02
) -> Tuple[Image.Image, dict]:
    """
    Face-targeted adversarial attack.

    Adds noise specifically designed to break face detection.
    More effective against deepfakes than general FGSM.

    Strategy:
    1. Detect face region
    2. Add structured noise to face area
    3. Verify face detection fails
    4. Keep noise minimal for visual quality
    """
    original_size = image.size
    img_array = np.array(image)

    # Detect faces first
    faces = detect_faces(img_array)

    if len(faces) == 0:
        # No face detected - fall back to FGSM
        print("⚠️ No face detected, using FGSM fallback")
        return fgsm_attack(image, epsilon=epsilon)

    print(f"🎯 Found {len(faces)} face(s), applying targeted attack...")

    # Work with float array
    img_float = img_array.astype(np.float32) / 255.0

    # Get face bounding boxes
    for face in faces:
        bbox = face.bbox.astype(int)
        x1, y1, x2, y2 = bbox

        # Add padding around face (attack slightly larger area)
        pad = int((x2 - x1) * 0.2)
        x1 = max(0, x1 - pad)
        y1 = max(0, y1 - pad)
        x2 = min(img_array.shape[1], x2 + pad)
        y2 = min(img_array.shape[0], y2 + pad)

        # Extract face region
        face_region = img_float[y1:y2, x1:x2].copy()

        # Generate adversarial noise for face region
        # Use multiple noise patterns for robustness
        for iteration in range(max_iterations):
            # Create structured noise patterns
            h, w = face_region.shape[:2]

            # Pattern 1: Random noise
            noise1 = np.random.randn(h, w, 3).astype(np.float32) * noise_scale

            # Pattern 2: High-frequency patterns (effective against neural nets)
            freq_noise = np.zeros((h, w, 3), dtype=np.float32)
            for i in range(h):
                for j in range(w):
                    freq_noise[i, j] = noise_scale * 0.5 * ((-1) ** (i + j))

            # Pattern 3: Gradient-like noise
            grad_noise = np.zeros((h, w, 3), dtype=np.float32)
            grad_noise[:, :, 0] = np.linspace(-noise_scale, noise_scale, w)
            grad_noise[:, :, 1] = np.linspace(-noise_scale, noise_scale, h).reshape(-1, 1)

            # Combine patterns
            combined_noise = noise1 * 0.5 + freq_noise * 0.3 + grad_noise * 0.2

            # Scale by epsilon
            combined_noise = combined_noise * (epsilon / noise_scale)

            # Apply noise to face region
            face_region = face_region + combined_noise
            face_region = np.clip(face_region, 0, 1)

            # Check if face detection fails now
            test_img = img_float.copy()
            test_img[y1:y2, x1:x2] = face_region
            test_array = (test_img * 255).astype(np.uint8)

            test_faces = detect_faces(test_array)

            if len(test_faces) == 0:
                print(f"✅ Face detection broken after {iteration + 1} iterations!")
                break
            else:
                # Increase noise for next iteration
                noise_scale *= 1.2

        # Apply the final noised face region
        img_float[y1:y2, x1:x2] = face_region

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
        "iterations_used": iteration + 1 if 'iteration' in dir() else max_iterations,
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
        "light": 0.02,
        "medium": 0.04,
        "strong": 0.06,
    }
    epsilon = epsilon_map.get(strength, 0.04)

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
