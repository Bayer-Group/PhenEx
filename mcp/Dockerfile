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

ENV MCP_TRANSPORT=streamable-http
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=9000
ENV INSPECTOR_PORT=6868

EXPOSE 9000 6868

CMD ["sh", "-c", "python /app/mcp/server.py & npx @modelcontextprotocol/inspector --port ${INSPECTOR_PORT} http://localhost:${MCP_PORT}/mcp/ & wait"]
