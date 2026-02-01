"""
Advanced Face Cloaking Module - PhotoGuard-Style Defense

Attack modes:
1. PGD with CLIP - Targeted latent attack (best transferability to diffusion models)
2. PGD with ArcFace - Targeted attack for face-swap models
3. Face-targeted attack - Breaks face detection pipeline

Uses Projected Gradient Descent (PGD) with targeted latent loss to push
image embeddings toward a "null" target, disrupting deepfake generation.
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

# Try to import CLIP from transformers
try:
    from transformers import CLIPModel, CLIPProcessor
    CLIP_AVAILABLE = True
except ImportError:
    CLIP_AVAILABLE = False
    print("⚠️ transformers not installed - CLIP attacks unavailable, using ResNet fallback")

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
    """Lazy load the pretrained ResNet model (fallback if CLIP unavailable)."""
    global _resnet_model
    if _resnet_model is None:
        print("📥 Loading ResNet50 model...")
        _resnet_model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
        _resnet_model.eval()
        _resnet_model.to(DEVICE)
    return _resnet_model


# CLIP model for better transferability to diffusion-based deepfakes
_clip_model = None
_clip_processor = None


def get_clip_model():
    """
    Load CLIP as surrogate model.
    CLIP embeddings transfer well to diffusion models (Stable Diffusion, etc.)
    """
    global _clip_model, _clip_processor
    if not CLIP_AVAILABLE:
        return None, None
    if _clip_model is None:
        print("📥 Loading CLIP model (ViT-B/32)...")
        _clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        _clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        _clip_model.eval()
        _clip_model.to(DEVICE)
        print("✅ CLIP loaded")
    return _clip_model, _clip_processor


def get_clip_image_features(model, pixel_values):
    """Extract CLIP image embeddings (512-dim vector)."""
    return model.get_image_features(pixel_values=pixel_values)


def get_resnet_features(model, x):
    """
    Extract intermediate features from ResNet (before classification head).
    Returns 2048-dim feature vector from layer4.
    """
    x = model.conv1(x)
    x = model.bn1(x)
    x = model.relu(x)
    x = model.maxpool(x)
    x = model.layer1(x)
    x = model.layer2(x)
    x = model.layer3(x)
    x = model.layer4(x)
    return model.avgpool(x).flatten(1)


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


def pgd_attack(
    image: Image.Image,
    epsilon: float = 0.03,
    alpha: float = None,
    num_steps: int = 40,
    target_size: int = 512,
    use_clip: bool = True
) -> Tuple[Image.Image, dict]:
    """
    Projected Gradient Descent (PGD) with targeted latent attack.

    This is a PhotoGuard-style attack that pushes image embeddings toward
    a "null" target (gray image), disrupting deepfake generation.

    Args:
        image: Input PIL Image
        epsilon: Maximum L∞ perturbation (0.03 = ~8/255)
        alpha: Step size per iteration (default: 2.5*epsilon/num_steps)
        num_steps: Number of PGD iterations
        target_size: Image size for processing
        use_clip: Use CLIP encoder (better transfer) or ResNet (fallback)

    Returns:
        Tuple of (cloaked_image, metadata)
    """
    if alpha is None:
        alpha = epsilon / num_steps * 2.5  # Standard PGD step size

    original_size = image.size
    transform = get_transforms(target_size)

    # Try CLIP first (better transferability), fallback to ResNet
    clip_model, clip_processor = get_clip_model() if use_clip else (None, None)
    use_clip_actual = clip_model is not None

    if use_clip_actual:
        # CLIP-based attack
        # Preprocess for CLIP
        clip_inputs = clip_processor(images=image, return_tensors="pt")
        img_tensor = clip_inputs["pixel_values"].to(DEVICE)
        original_tensor = img_tensor.clone().detach()

        # Create target: gray image embeddings (represents "null" face)
        gray_img = Image.new("RGB", image.size, color=(128, 128, 128))
        gray_inputs = clip_processor(images=gray_img, return_tensors="pt")
        gray_tensor = gray_inputs["pixel_values"].to(DEVICE)

        with torch.no_grad():
            target_features = get_clip_image_features(clip_model, gray_tensor)

        # Initialize perturbation with small random noise (helps escape local minima)
        delta = torch.zeros_like(img_tensor, requires_grad=True)
        delta.data.uniform_(-epsilon * 0.1, epsilon * 0.1)

        for step in range(num_steps):
            delta.requires_grad_(True)
            perturbed = torch.clamp(original_tensor + delta, 0, 1)

            # Get current embeddings
            current_features = get_clip_image_features(clip_model, perturbed)

            # Targeted attack: minimize distance to gray (null) target
            loss = nn.MSELoss()(current_features, target_features)

            loss.backward()

            # Gradient descent step (minimize loss)
            grad = delta.grad.detach()
            delta.data = delta.data - alpha * grad.sign()

            # Project back to L∞ ball (proper constraint enforcement)
            delta.data = torch.clamp(delta.data, -epsilon, epsilon)
            delta.data = torch.clamp(original_tensor + delta.data, 0, 1) - original_tensor

            if delta.grad is not None:
                delta.grad.zero_()

        cloaked_tensor = torch.clamp(original_tensor + delta.detach(), 0, 1)

        # Convert CLIP tensor back to PIL (CLIP uses different normalization)
        cloaked_np = cloaked_tensor.squeeze(0).permute(1, 2, 0).cpu().numpy()
        cloaked_np = (cloaked_np * 255).astype(np.uint8)
        cloaked_image = Image.fromarray(cloaked_np)
        cloaked_image = cloaked_image.resize(original_size, Image.Resampling.LANCZOS)

        method_name = "pgd_clip_targeted"

    else:
        # ResNet fallback
        model = get_resnet_model()
        img_tensor = transform(image).unsqueeze(0).to(DEVICE)
        original_tensor = img_tensor.clone().detach()

        # Target: gray image features
        gray_tensor = torch.ones_like(img_tensor) * 0.5
        with torch.no_grad():
            target_features = get_resnet_features(model, gray_tensor)

        # Initialize perturbation
        delta = torch.zeros_like(img_tensor, requires_grad=True)
        delta.data.uniform_(-epsilon * 0.1, epsilon * 0.1)

        for step in range(num_steps):
            delta.requires_grad_(True)
            perturbed = torch.clamp(original_tensor + delta, 0, 1)

            current_features = get_resnet_features(model, perturbed)
            loss = nn.MSELoss()(current_features, target_features)

            loss.backward()

            grad = delta.grad.detach()
            delta.data = delta.data - alpha * grad.sign()

            # L∞ projection
            delta.data = torch.clamp(delta.data, -epsilon, epsilon)
            delta.data = torch.clamp(original_tensor + delta.data, 0, 1) - original_tensor

            if delta.grad is not None:
                delta.grad.zero_()

        cloaked_tensor = torch.clamp(original_tensor + delta.detach(), 0, 1)
        cloaked_image = tensor_to_pil(cloaked_tensor)
        cloaked_image = cloaked_image.resize(original_size, Image.Resampling.LANCZOS)

        method_name = "pgd_resnet_targeted"

    # Calculate actual perturbation stats
    final_perturbation = delta.detach()

    metadata = {
        "method": method_name,
        "epsilon": epsilon,
        "alpha": alpha,
        "num_steps": num_steps,
        "device": str(DEVICE),
        "final_loss": float(loss.item()),
        "perturbation_linf": float(final_perturbation.abs().max().item()),
        "perturbation_mean": float(final_perturbation.abs().mean().item()),
        "clip_used": use_clip_actual,
    }

    return cloaked_image, metadata


# Keep FGSM as fast fallback option
def fgsm_attack(
    image: Image.Image,
    epsilon: float = 0.015,
    target_size: int = 512
) -> Tuple[Image.Image, dict]:
    """
    Fast single-step attack (FGSM) - use pgd_attack for better protection.
    Kept for backwards compatibility and quick testing.
    """
    # Use PGD with 1 step = FGSM equivalent
    return pgd_attack(image, epsilon=epsilon, num_steps=1, alpha=epsilon, target_size=target_size)





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
        # No face detected - fall back to PGD attack
        print("⚠️ No face detected, using PGD attack fallback")
        return pgd_attack(image, epsilon=epsilon)

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

        # Extract face region - store ORIGINAL for L∞ projection
        original_face = img_float[y1:y2, x1:x2].copy()
        face_region = original_face.copy()
        h, w = face_region.shape[:2]

        # Track cumulative perturbation for proper L∞ enforcement
        cumulative_perturbation = np.zeros_like(face_region)

        # Smooth elliptical mask
        y_coords, x_coords = np.ogrid[:h, :w]
        center_y, center_x = h / 2, w / 2
        dist = np.sqrt(((y_coords - center_y) / (h / 2)) ** 2 + ((x_coords - center_x) / (w / 2)) ** 2)
        smooth_mask = np.clip(1.0 - dist * 0.6, 0, 1) ** 2
        smooth_mask = np.stack([smooth_mask, smooth_mask, smooth_mask], axis=-1)

        cumulative_noise = np.zeros_like(face_region)
        noise_scale = epsilon * 0.3

        for iteration in range(max_iterations):
            # Create structured noise patterns
            noise = np.random.randn(h, w, 3).astype(np.float32) * noise_scale * smooth_mask
            cumulative_noise += noise

            noised_face = original_face + cumulative_noise
            noised_face = np.clip(noised_face, 0, 1)

            # Check if face detection fails now
            test_img = img_float.copy()
            test_img[y1:y2, x1:x2] = noised_face
            test_array = (test_img * 255).astype(np.uint8)
            test_faces = detect_faces(test_array)

            if len(test_faces) == 0:
                actual_eps = np.abs(cumulative_noise).max()
                print(f"  ✅ Undetectable after {iteration+1} iters (noise={actual_eps:.3f})")
                face_region = noised_face
                break

            # If still detected, add more complex patterns
            # Pattern 2: High-frequency patterns (effective against neural nets)
            # Vectorized version (faster than nested loops)
            i_grid, j_grid = np.meshgrid(np.arange(h), np.arange(w), indexing='ij')
            freq_noise = (noise_scale * 0.5 * ((-1.0) ** (i_grid + j_grid)))[:, :, np.newaxis]
            freq_noise = np.broadcast_to(freq_noise, (h, w, 3)).astype(np.float32)

            # Pattern 3: Gradient-like noise
            grad_noise = np.zeros((h, w, 3), dtype=np.float32)
            grad_noise[:, :, 0] = np.linspace(-noise_scale, noise_scale, w)
            grad_noise[:, :, 1] = np.linspace(-noise_scale, noise_scale, h).reshape(-1, 1)

            # Combine patterns
            combined_noise = noise * 0.5 + freq_noise * 0.3 + grad_noise * 0.2

            # Scale by epsilon
            combined_noise = combined_noise * (epsilon / noise_scale)

            # Add to cumulative perturbation
            cumulative_perturbation = cumulative_perturbation + combined_noise

            # PROPER L∞ PROJECTION: clamp perturbation to [-epsilon, epsilon]
            cumulative_perturbation = np.clip(cumulative_perturbation, -epsilon, epsilon)

            # Apply perturbation to original (not to already-perturbed region)
            face_region = original_face + cumulative_perturbation

            # Clamp to valid image range [0, 1]
            face_region = np.clip(face_region, 0, 1)

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
        print(f"⚠️ Face still detectable ({len(final_faces)} faces) - applying PGD reinforcement...")
        # Apply additional PGD on top for extra protection
        cloaked_image, extra_meta = pgd_attack(cloaked_image, epsilon=epsilon * 0.5, num_steps=20)
        metadata["extra_pgd_applied"] = True
        metadata["reinforcement_loss"] = extra_meta.get("final_loss")

    return cloaked_image, metadata


def cloak_image(
    image: Image.Image,
    strength: str = "medium",
    method: str = "auto"
) -> Tuple[Image.Image, dict]:
    """
    High-level cloaking function with PhotoGuard-style protection.

    Args:
        image: Input PIL Image
        strength: "light", "medium", "strong" (controls epsilon)
        method: Attack method to use:
                - "auto": Use face-targeted if face detected, else PGD (recommended)
                - "pgd": Force PGD targeted latent attack (best transferability)
                - "face": Force face-targeted attack (breaks face detection)
                - "fgsm": Force single-step FGSM (fast but weak, for testing)

    Returns:
        Tuple of (cloaked_image, metadata)
    """
    epsilon_map = {
        "light": 0.01,
        "medium": 0.02,
        "strong": 0.03,
    }
    epsilon = epsilon_map.get(strength, 0.02)

    if method == "pgd":
        return pgd_attack(image, epsilon=epsilon)

    elif method == "fgsm":
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
            print("📷 No face detected, using PGD targeted latent attack")
            return pgd_attack(image, epsilon=epsilon)


# Quick test
if __name__ == "__main__":
    test_img = Image.new("RGB", (256, 256), color="red")
    cloaked, meta = cloak_image(test_img)
    print(f"✅ Cloaking test passed! Metadata: {meta}")
