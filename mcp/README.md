# PhenEx Cohort Builder MCP Server

An MCP (Model Context Protocol) server that exposes PhenEx cohort building and Snowflake data exploration functionality to AI assistants.

## What's Included

| Tool                               | Description                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| `phenex_list_available_phenotypes` | List all PhenEx phenotype classes with descriptions            |
| `phenex_get_phenotype_spec`        | Get detailed spec/docs for a phenotype class (or `"Codelist"`) |
| `phenex_list_available_codelists`  | List codelists from configured CSV/Excel directory             |
| `phenex_get_codelist`              | Get the full contents of a specific codelist by name           |
| `phenex_validate_phenotype`        | Validate a single phenotype definition compiles correctly      |
| `phenex_validate_cohort`           | Validate a cohort definition JSON without executing            |
| `phenex_execute_cohort`            | Validate and optionally execute a cohort against Snowflake     |
| `snowflake_list_databases`         | List/search Snowflake databases                                |
| `snowflake_list_schemas`           | List schemas inside a database                                 |
| `snowflake_list_tables`            | List tables inside a schema                                    |
| `snowflake_get_table_columns`      | Get column definitions for a table                             |
| `snowflake_preview_table`          | Preview sample rows                                            |
| `snowflake_select_rows`            | Query rows with optional WHERE filter                          |
| `snowflake_get_distinct_values`    | Get distinct values from a column                              |
| `snowflake_count_rows`             | Count rows with optional filter                                |

## Prerequisites

- Python 3.12+
- Snowflake credentials (for data exploration and cohort execution)
- Codelists (optional but highly recommended)

## Setup

```bash
git clone https://github.com/Bayer-Group/PhenEx phenex-mcp
cd phenex-mcp/mcp
```

### 1. Create a virtual environment and install dependencies

```bash
python -m venv .venv
source .venv/bin/activate           # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Snowflake credentials

```bash
cp mcp/.env.example mcp/.env
# Edit mcp/.env with your configuration details
```

### 3. Test the server

**All commands must be run from the mcp/ directory**

```bash
# Interactive testing with MCP Inspector (run from repo root)
npx @modelcontextprotocol/inspector bash start.sh
```

This opens a web UI where you can browse tools, call them with sample inputs, and see responses — no AI client needed.

## Running

**Always run from the repo root directory.**

### stdio (default — for Claude Desktop, VS Code, etc.)

```bash
bash start.sh
```

### HTTP (for remote / multi-client access)

```bash
bash start_http.sh
# or with custom port:
MCP_PORT=8080 bash start_http.sh
```

### Docker

Build and run the MCP server as a Docker container. The build context is the **repo root**.

```bash
# Build (from the repo root)
docker build -t phenex-mcp -f mcp/Dockerfile .

# Run (MCP server on 9000, Inspector on 6868)
docker run --rm -p 9000:9000 -p 6868:6868 \
  --env-file mcp/.env \
  phenex-mcp
```

To mount a local codelists directory into the container:

```bash
docker run --rm -p 9000:9000 \
  --env-file mcp/.env \
  -v /path/to/codelists:/codelists \
  -e PHENEX_CODELIST_DIR=/codelists \
  phenex-mcp
```

Override the port or transport via environment variables:

```bash
docker run --rm -p 8080:8080 \
  --env-file mcp/.env \
  -e MCP_PORT=8080 \
  phenex-mcp
```

## Client Configuration

### LLM Instructions

The file `mcp/llm-instructions.md` contains detailed guidance for AI assistants on how to use the PhenEx tools effectively. Copy its contents into your client's system prompt or custom instructions:

- **Claude Desktop** — paste into your Project's custom instructions
- **VS Code (Copilot)** — copy to `.github/copilot-instructions.md` in your workspace
- **Cursor** — paste into `.cursor/rules`

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "phenex": {
      "command": "bash",
      "args": ["/absolute/path/to/PhenEx/mcp/start.sh"],
      "env": {}
    }
  }
}
```

### VS Code (Copilot)

Add to your `.vscode/mcp.json` or workspace settings:

```json
{
  "servers": {
    "phenex": {
      "command": "bash",
      "args": ["${workspaceFolder}/mcp/start.sh"],
      "env": {}
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "phenex": {
      "command": "bash",
      "args": ["/absolute/path/to/PhenEx/mcp/start.sh"],
      "env": {}
    }
  }
}
```

## File Structure

```
mcp/
├── server.py              # Main FastMCP server with tool registrations
├── phenotype_registry.py  # PhenEx phenotype class registry
├── codelist_store.py      # Load and serve codelists from CSV/Excel files
├── snowflake_explorer.py  # Snowflake data warehouse utilities
├── cohort_tools.py        # Cohort validation, translation, execution
├── llm-instructions.md    # Instructions for LLMs using this server
├── mcp.json               # Example MCP client config
├── start.sh               # Launch script (stdio)
├── start_http.sh          # Launch script (HTTP)
├── .env.example           # Environment variable template
├── requirements.txt       # Python dependencies
└── README.md              # This file
```

## Environment Variables

| Variable                           | Required           | Description                                     |
| ---------------------------------- | ------------------ | ----------------------------------------------- |
| `SNOWFLAKE_USER`                   | Yes (for SF tools) | Snowflake username                              |
| `SNOWFLAKE_PASSWORD`               | Yes (for SF tools) | Snowflake password                              |
| `SNOWFLAKE_ACCOUNT`                | Yes (for SF tools) | Snowflake account identifier                    |
| `SNOWFLAKE_WAREHOUSE`              | Yes (for SF tools) | Snowflake warehouse name                        |
| `SNOWFLAKE_ROLE`                   | Yes (for SF tools) | Snowflake role                                  |
| `SNOWFLAKE_SOURCE_DATABASE`        | For execution      | Source database for cohort execution            |
| `SNOWFLAKE_SOURCE_SCHEMA`          | For execution      | Source schema for cohort execution              |
| `SNOWFLAKE_DEST_DATABASE`          | For execution      | Destination database (schema is auto-generated) |
| `PHENEX_CODELIST_DIR`              | For codelist tools | Directory containing codelist CSV/Excel files   |
| `PHENEX_CODELIST_CODE_COLUMN`      | No                 | Code column name (default `code`)               |
| `PHENEX_CODELIST_NAME_COLUMN`      | No                 | Codelist name column (default `codelist`)       |
| `PHENEX_CODELIST_CODE_TYPE_COLUMN` | No                 | Code type column (default `code_type`)          |
| `MCP_TRANSPORT`                    | No                 | `stdio` (default), `streamable-http`, or `sse`  |
| `MCP_HOST`                         | No                 | HTTP host (default `0.0.0.0`)                   |
| `MCP_PORT`                         | No                 | HTTP port (default `9000`)                      |
| `LOG_LEVEL`                        | No                 | Logging level (default `INFO`)                  |
