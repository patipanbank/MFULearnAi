FROM python:3.11-slim

LABEL maintainer="MFU IT Team"
LABEL description="AWS Bedrock API Gateway"

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Create user for security
RUN groupadd -r apigateway && useradd -r -g apigateway apigateway

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY config/ ./config/
COPY services/ ./services/
COPY routes/ ./routes/
COPY middleware/ ./middleware/
COPY main.py .

# Change ownership to apigateway user
RUN chown -R apigateway:apigateway /app

# Switch to non-root user
USER apigateway

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 