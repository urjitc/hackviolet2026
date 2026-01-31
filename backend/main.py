"""
Digital Witchcraft - Backend API

Endpoints:
- POST /cloak: Apply adversarial cloaking to an image
- POST /prove/{id}: Generate proof that cloaking works
- GET /results/{id}: Get proof images for dashboard
- GET /health: Health check
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from io import BytesIO
import base64
from typing import Optional
from pathlib import Path

from cloak import cloak_image
from proof import generate_proof
from storage import (
    generate_id,
    save_upload,
    save_cloaked,
    save_proof_images,
    get_result_paths,
    image_to_base64,
    base64_to_image,
    load_image,
    RESULTS_DIR,
)

# Initialize FastAPI
app = FastAPI(
    title="Digital Witchcraft API",
    description="Adversarial cloaking to protect your photos from deepfakes",
    version="1.0.0",
)

# CORS - Allow all origins for hackathon
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve result images statically
app.mount("/images", StaticFiles(directory=str(RESULTS_DIR)), name="images")


@app.get("/")
async def root():
    """API root - welcome message."""
    return {
        "message": "🔮 Digital Witchcraft API",
        "version": "1.0.0",
        "endpoints": {
            "POST /cloak": "Apply cloaking to an image",
            "POST /prove/{id}": "Generate proof of protection",
            "GET /results/{id}": "Get proof images",
            "GET /health": "Health check",
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "digital-witchcraft"}


# ============================================================================
# CLOAK ENDPOINT - The main magic
# ============================================================================

@app.post("/cloak")
async def cloak_endpoint(
    file: UploadFile = File(...),
    strength: str = Form(default="medium"),
):
    """
    Apply adversarial cloaking to protect an image from deepfakes.

    - **file**: Image file (JPEG, PNG)
    - **strength**: "light", "medium", or "strong"

    Returns the cloaked image as base64 and a session ID.
    """
    try:
        # Read uploaded image
        contents = await file.read()
        image = Image.open(BytesIO(contents)).convert("RGB")

        # Generate session ID
        session_id = generate_id()

        # Save original
        save_upload(image, session_id)

        # Apply cloaking
        cloaked_image, metadata = cloak_image(image, strength=strength)

        # Save cloaked version
        cloaked_path = save_cloaked(cloaked_image, session_id)

        # Convert to base64 for response
        cloaked_b64 = image_to_base64(cloaked_image)

        return {
            "id": session_id,
            "status": "success",
            "cloaked_image": cloaked_b64,
            "metadata": metadata,
            "message": "✨ Image successfully cloaked!"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cloaking failed: {str(e)}")


@app.post("/cloak/base64")
async def cloak_base64_endpoint(
    image: str = Form(...),
    strength: str = Form(default="medium"),
):
    """
    Apply cloaking to a base64-encoded image.
    Alternative endpoint for mobile apps.
    """
    try:
        # Decode base64
        pil_image = base64_to_image(image)

        # Generate session ID
        session_id = generate_id()

        # Save original
        save_upload(pil_image, session_id)

        # Apply cloaking
        cloaked_image, metadata = cloak_image(pil_image, strength=strength)

        # Save cloaked version
        save_cloaked(cloaked_image, session_id)

        # Convert to base64
        cloaked_b64 = image_to_base64(cloaked_image)

        return {
            "id": session_id,
            "status": "success",
            "cloaked_image": cloaked_b64,
            "metadata": metadata,
            "message": "✨ Image successfully cloaked!"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cloaking failed: {str(e)}")


# ============================================================================
# PROOF ENDPOINT - Shows that cloaking works
# ============================================================================

@app.post("/prove/{session_id}")
async def prove_endpoint(session_id: str):
    """
    Generate proof that cloaking protects against deepfakes.

    Runs face-swap on both original and cloaked versions.
    Original: Face-swap succeeds
    Cloaked: Face-swap fails/glitches

    Returns URLs to all 4 comparison images.
    """
    try:
        # Get saved images
        paths = get_result_paths(session_id)
        if not paths or "original" not in paths or "cloaked" not in paths:
            raise HTTPException(status_code=404, detail="Session not found. Run /cloak first.")

        # Load images
        original = load_image(paths["original"])
        cloaked = load_image(paths["cloaked"])

        # Generate proof
        proof_result = generate_proof(original, cloaked)

        # Save proof images
        saved_paths = save_proof_images(
            session_id,
            proof_result["original"],
            proof_result["cloaked"],
            proof_result["deepfake_original"],
            proof_result["deepfake_cloaked"]
        )

        # Convert paths to URLs
        base_url = f"/images"
        urls = {
            "original": f"{base_url}/{session_id}_original.png",
            "cloaked": f"{base_url}/{session_id}_cloaked.png",
            "deepfake_original": f"{base_url}/{session_id}_deepfake_original.png",
            "deepfake_cloaked": f"{base_url}/{session_id}_deepfake_cloaked.png",
        }

        return {
            "id": session_id,
            "status": "success",
            "images": urls,
            "metadata": proof_result["metadata"],
            "message": "🛡️ Proof generated! Cloaking is effective."
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proof generation failed: {str(e)}")


# ============================================================================
# RESULTS ENDPOINT - For dashboard
# ============================================================================

@app.get("/results/{session_id}")
async def get_results(session_id: str):
    """
    Get all result images for a session.
    Used by the web dashboard to display the proof.
    """
    paths = get_result_paths(session_id)
    if not paths:
        raise HTTPException(status_code=404, detail="Session not found")

    # Convert to URLs
    base_url = f"/images"
    urls = {}
    for key, path in paths.items():
        filename = Path(path).name
        urls[key] = f"{base_url}/{filename}"

    return {
        "id": session_id,
        "status": "success",
        "images": urls,
    }


@app.get("/results/{session_id}/{image_type}")
async def get_result_image(session_id: str, image_type: str):
    """
    Get a specific result image file.

    image_type: "original", "cloaked", "deepfake_original", "deepfake_cloaked"
    """
    valid_types = ["original", "cloaked", "deepfake_original", "deepfake_cloaked"]
    if image_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid image type. Use: {valid_types}")

    filepath = RESULTS_DIR / f"{session_id}_{image_type}.png"
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(filepath, media_type="image/png")


# ============================================================================
# Run with: uvicorn main:app --reload --port 8000
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
