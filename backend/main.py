"""
Digital Witchcraft - Backend API

Endpoints:
- POST /cloak: Apply adversarial cloaking to an image
- GET /results/{id}: Get cloaked images for dashboard
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
from storage import (
    generate_id,
    save_upload,
    save_cloaked,
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
            "POST /cloak/base64": "Apply cloaking to base64 image",
            "GET /results/{id}": "Get cloaked images",
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
# RESULTS ENDPOINT - For dashboard
# ============================================================================

@app.get("/results/{session_id}")
async def get_results(session_id: str):
    """
    Get all result images for a session.
    Used by the web dashboard to display the cloaked images.
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

    image_type: "original", "cloaked"
    """
    valid_types = ["original", "cloaked"]
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
