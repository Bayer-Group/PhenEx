FROM python:3.12-slim
WORKDIR /app

# Install system dependencies for health checks
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --root-user-action=ignore --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p /data/cohorts && \
    mkdir -p /data/users && \
    mkdir -p /data/_model_cache

# Download model during build
ENV RAG_CACHE=/data/_model_cache
COPY scripts/download_model.py /tmp/download_model.py
RUN cd /tmp && python download_model.py

EXPOSE 8000
CMD python -m fastapi run main.py --reload
