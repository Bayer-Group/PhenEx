#!/usr/bin/env bash
# Launch the PhenEx Cohort Builder MCP server with HTTP transport
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Activate the project virtualenv
if [ -f "$REPO_ROOT/.venv/bin/activate" ]; then
    source "$REPO_ROOT/.venv/bin/activate"
fi

# Load .env if present
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

export MCP_TRANSPORT="${MCP_TRANSPORT:-streamable-http}"
export MCP_HOST="${MCP_HOST:-0.0.0.0}"
export MCP_PORT="${MCP_PORT:-9000}"

echo "Starting PhenEx MCP server on ${MCP_HOST}:${MCP_PORT} (${MCP_TRANSPORT})"
exec python "$SCRIPT_DIR/server.py" "$@"
