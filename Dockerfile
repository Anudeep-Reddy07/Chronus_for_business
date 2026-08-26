# Use official Python runtime as parent image
FROM python:3.11-slim-bullseye

# Set the working directory in the container
WORKDIR /app

# Ensure directory permissions
RUN chmod 777 /app

ENV PYTHONPATH="/app"
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies (git, ffmpeg)
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy codebase into the image
COPY . .

# Expose the API & Studio port
EXPOSE 8080

# Start Chronus FastAPI application
CMD ["python3", "main.py"]
