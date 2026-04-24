# Use a slim Python 3.12 image as the base
FROM python:3.12-slim

# Set environment variables to prevent Python from writing .pyc files and to buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies, Node.js, pnpm, and ngrok
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm \
    && curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
    && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | tee /etc/apt/sources.list.d/ngrok.list \
    && apt-get update && apt-get install -y ngrok \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory for the application
WORKDIR /app

# Copy the backend requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy frontend package.json and install Node dependencies
COPY frontend/package.json frontend/
# Try to copy pnpm-lock.yaml if it exists (ignoring error if not)
COPY frontend/pnpm-lock.yam[l] frontend/
RUN cd frontend && pnpm install

# Copy the entire application code
COPY . .

# Expose ports for Next.js (3000) and FastAPI (8000)
EXPOSE 3000 8000

# Create a startup script that runs all three processes
RUN echo '#!/bin/bash\n\
echo "Starting FastAPI backend..."\n\
uvicorn api:app --reload --host 0.0.0.0 --port 8000 &\n\
\n\
echo "Starting ngrok..."\n\
if [ -z "$NGROK_AUTHTOKEN" ]; then\n\
  echo "Warning: NGROK_AUTHTOKEN is not set. Ngrok may not work correctly or might have session limits."\n\
else\n\
  ngrok config add-authtoken $NGROK_AUTHTOKEN\n\
fi\n\
ngrok http 8000 &\n\
\n\
echo "Starting Next.js frontend..."\n\
cd frontend && pnpm dev -H 0.0.0.0\n\
' > /app/start.sh && chmod +x /app/start.sh

# Run the startup script
CMD ["/app/start.sh"]
