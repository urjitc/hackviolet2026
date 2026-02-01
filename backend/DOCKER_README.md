# Docker Setup for Digital Witchcraft Backend

## Quick Start

### Using Docker Compose (Recommended)

1. From the project root directory:
```bash
docker-compose up --build
```

2. The API will be available at: `http://localhost:8000`

3. To stop the container:
```bash
docker-compose down
```

### Using Docker directly

1. Build the image:
```bash
cd backend
docker build -t digital-witchcraft-backend .
```

2. Run the container:
```bash
docker run -p 8000:8000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/results:/app/results \
  digital-witchcraft-backend
```

## API Endpoints

- `GET /` - API documentation
- `GET /health` - Health check
- `POST /cloak` - Apply cloaking to uploaded image
- `POST /cloak/base64` - Apply cloaking to base64 image
- `POST /prove/{id}` - Generate proof for session
- `POST /prove/v2` - Generate proof with real face swap
- `GET /results/{id}` - Get result images

## Development

### Rebuild without cache
```bash
docker-compose build --no-cache
```

### View logs
```bash
docker-compose logs -f backend
```

### Run in development mode
```bash
docker-compose up --build --force-recreate
```

## Volumes

- `./uploads` - Persist uploaded images
- `./results` - Persist processed results

## Health Check

The container includes a health check that monitors the `/health` endpoint. The service is considered healthy when it responds successfully to HTTP requests.

## Environment Variables

- `PYTHONUNBUFFERED=1` - Ensures Python output is immediately visible in logs
