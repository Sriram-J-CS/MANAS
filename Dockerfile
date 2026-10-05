# Multi-stage production Dockerfile for MANAS Scale-Ready Backend
FROM python:3.11-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final Runtime Image
FROM python:3.11-slim

WORKDIR /app

# Security: Create non-root user
RUN groupadd -g 1001 manas && \
    useradd -u 1001 -g manas -s /bin/bash -m manas

# Copy Python packages from builder
COPY --from=builder /root/.local /home/manas/.local
ENV PATH=/home/manas/.local/bin:$PATH

# Copy backend application source
COPY backend /app/backend

# Create runtime directories with permissions
RUN mkdir -p /app/backend/data && \
    chown -R manas:manas /app

USER manas

EXPOSE 8008

ENV PORT=8008 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    WORKERS=4

WORKDIR /app/backend

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8008/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8008", "--workers", "4"]
