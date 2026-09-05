# Use official slim Python image
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY backend/ ./backend/
COPY run.py .
COPY .env.example .env

# Expose port
EXPOSE 8000

# Run unified server
CMD ["python", "run.py"]
