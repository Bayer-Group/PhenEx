FROM python:3.12-slim

WORKDIR /app

# Install Node.js for MCP Inspector
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (includes phenex from PyPI)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Pre-install MCP Inspector
RUN npm install -g @modelcontextprotocol/inspector

# Copy MCP server code
COPY . /app/mcp/

ENV MCP_TRANSPORT=stdio

EXPOSE 6277 6274

CMD ["npx", "@modelcontextprotocol/inspector", "python", "/app/mcp/server.py"]
