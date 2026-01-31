"""
Storage module for handling image uploads and results.
Uses local filesystem for hackathon speed - swap to S3/Supabase later if needed.
"""

import os
import base64
import uuid
from pathlib import Path
from PIL import Image
from io import BytesIO
from typing import Optional

# Directories
BASE_DIR = Path(__file__).parent
UPLOADS_DIR = BASE_DIR / "uploads"
RESULTS_DIR = BASE_DIR / "results"

# Ensure directories exist
UPLOADS_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)


def generate_id() -> str:
    """Generate a unique ID for a cloaking session."""
    return str(uuid.uuid4())[:8]


def save_image(image: Image.Image, directory: Path, name: str) -> str:
    """Save a PIL Image to disk and return the path."""
    filepath = directory / f"{name}.png"
    image.save(filepath, "PNG")
    return str(filepath)


def load_image(filepath: str) -> Image.Image:
    """Load an image from disk."""
    return Image.open(filepath).convert("RGB")


def image_to_base64(image: Image.Image) -> str:
    """Convert PIL Image to base64 string."""
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def base64_to_image(b64_string: str) -> Image.Image:
    """Convert base64 string to PIL Image."""
    image_data = base64.b64decode(b64_string)
    return Image.open(BytesIO(image_data)).convert("RGB")


def save_upload(image: Image.Image, session_id: str) -> str:
    """Save an uploaded original image."""
    return save_image(image, UPLOADS_DIR, f"{session_id}_original")


def save_cloaked(image: Image.Image, session_id: str) -> str:
    """Save a cloaked image."""
    return save_image(image, RESULTS_DIR, f"{session_id}_cloaked")


def save_proof_images(
    session_id: str,
    original: Image.Image,
    cloaked: Image.Image,
    deepfake_original: Image.Image,
    deepfake_cloaked: Image.Image
) -> dict:
    """Save all proof images and return paths."""
    return {
        "original": save_image(original, RESULTS_DIR, f"{session_id}_original"),
        "cloaked": save_image(cloaked, RESULTS_DIR, f"{session_id}_cloaked"),
        "deepfake_original": save_image(deepfake_original, RESULTS_DIR, f"{session_id}_deepfake_original"),
        "deepfake_cloaked": save_image(deepfake_cloaked, RESULTS_DIR, f"{session_id}_deepfake_cloaked"),
    }


def get_result_paths(session_id: str) -> Optional[dict]:
    """Get paths to all result images for a session."""
    # Original is in uploads, everything else in results
    original_path = UPLOADS_DIR / f"{session_id}_original.png"
    cloaked_path = RESULTS_DIR / f"{session_id}_cloaked.png"

    # Check if at least original and cloaked exist
    if not original_path.exists() or not cloaked_path.exists():
        return None

    paths = {
        "original": original_path,
        "cloaked": cloaked_path,
        "deepfake_original": RESULTS_DIR / f"{session_id}_deepfake_original.png",
        "deepfake_cloaked": RESULTS_DIR / f"{session_id}_deepfake_cloaked.png",
    }

    return {k: str(v) for k, v in paths.items() if v.exists()}
