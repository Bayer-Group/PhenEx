# PhenEx Application

This directory contains the full-stack web application for PhenEx, including the backend API, frontend UI, and supporting infrastructure.

## 🏗️ Architecture

The PhenEx application consists of several components:

- **Backend**: FastAPI-based REST API (`/backend`) with Python support for PhenEx phenotype extraction
- **Frontend**: React + TypeScript application (`/ui`) for interactive cohort building and data visualization
- **Database**: PostgreSQL database for data storage and management

## 🚀 Quick Start

Follow these steps to get the PhenEx application running locally:

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)
- [Git](https://git-scm.com/downloads)
- At least 4GB of available RAM

### Installation Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/Bayer-Group/PhenEx.git
   cd PhenEx/app
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Then edit the `.env` file and configure the required settings. **Key configuration sections:**

   **Database Configuration:**

   ```bash
   POSTGRES_HOST=db
   POSTGRES_PASSWORD=password          # Change this for production!
   POSTGRES_DB=phenex
   POSTGRES_USER=phenex
   POSTGRES_PORT=5432
   ```

   **Authentication Configuration:**
   Choose your authentication method by configuring the relevant section:
   - **Azure AD (Enterprise):** Configure `PHENEX_AUTH__AD__*` variables with your Azure tenant details
   - **Password Auth (JWT):** Set `PHENEX_AUTH__PASSWORD__SECRET` to a secure secret
   - **Anonymous (Development only):** Set `PHENEX_AUTH__ANONYMOUS__TOKEN` and `PHENEX_AUTH__ANONYMOUS__USER_ID`

   **Data Warehouse Configuration:**

   ```bash
   # For Snowflake integration (optional)
   SNOWFLAKE_USER=your-username
   SNOWFLAKE_PASSWORD=your-password
   SNOWFLAKE_ACCOUNT=your-account
   SNOWFLAKE_WAREHOUSE=your-warehouse
   SNOWFLAKE_ROLE=your-role
   ```

   **AI Features (Optional):**

   ```bash
   # For AI-powered features
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
   AZURE_OPENAI_API_KEY=your-api-key
   OPENAI_API_VERSION=2025-01-01-preview
   ```

   **Frontend Configuration:**

   ```bash
   VITE_BACKEND_URL=http://localhost:8000
   VITE_ALLOWED_HOSTS=http://localhost:5173
   ENABLE_ANONYMOUS_USERS=false
   ```

   **Important**: Never commit the actual `.env` file with real credentials to version control.

3. **Start the application**

   ```bash
   docker compose up -d
   ```

   This command will:
   - Build and start all required services
   - Automatically initialize the PostgreSQL database with PhenEx schemas
   - Start the backend API server on port 8000
   - Start the frontend development server on port 5173
   - Launch Adminer for database management

### 🌐 Accessing the Application

Once all services are running (this may take a few minutes on first startup):

- **Frontend Application**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs (FastAPI Swagger docs)
- **Database Admin (Adminer)**: http://localhost:8080
  - Server: `db`
  - Username: `phenex`
  - Password: (see `POSTGRES_PASSWORD` in `.env`)
  - Database: `phenex`

#### Default Test Users

When you first start the application, **the database initialization automatically creates default test users**. You don't need to manually create users or look up IDs from the database.

📝 **Configuration for these users is in the `.env`**:

- `PUBLIC_USER_ID` - The UUID of the public user
- `DEFAULT_USER_PASSWORD` - The password for all default test users (defaults to `phenex`)
- `DEFAULT_USER_EMAIL_PUBLIC` - Email for public user (defaults to `public@phenex.ai`)
- `DEFAULT_USER_EMAIL_1` - Email for test user 1 (defaults to `test@phenex.ai`)
- `DEFAULT_USER_EMAIL_2` - Email for test user 2 (defaults to `test2@phenex.ai`)

These settings allow you to customize the default user credentials without modifying code.

### 👤 Authentication

The application supports multiple authentication methods. Configure your preferred method in the `.env` file:

#### 1. **Azure AD (Recommended for Production)**

```bash
PHENEX_AUTH__AD__TENANT=your-azure-ad-tenant-id
PHENEX_AUTH__AD__AUD=your-azure-ad-audience-id
# Configure claims mapping as needed
```

#### 2. **Password Authentication (JWT)**

```bash
PHENEX_AUTH__PASSWORD__SECRET=your-secure-secret-key
```

Create user accounts through the API or admin interface.

#### 3. **Anonymous Authentication (Development Only)**

```bash
PHENEX_AUTH__ANONYMOUS__TOKEN=anon-user
PHENEX_AUTH__ANONYMOUS__USER_ID=your-anonymous-user-uuid
ENABLE_ANONYMOUS_USERS=true
```

⚠️ **Warning**: Only use anonymous authentication in development environments.

## 🔧 Development

### Environment Configuration

The application uses environment variables for configuration. Key files:

- `.env` - Main configuration file (copy from `.env.example`)
- Configuration is passed to all Docker Compose services

### Database Schema Management

Database migrations are managed automatically using the `migrate` tool:

- Migration files are in `backend/migrate/`
- **Migrations run automatically** when you start the application with `docker compose up`
- Database schema is initialized on first startup

**Manual database reset** (if needed):

```bash
# Complete database reset
docker compose down -v  # Remove volumes and data
docker compose up       # Recreate with fresh database
```

### Development Mode

The Docker Compose setup is configured for development with:

- **Hot reload**: Both frontend and backend automatically restart when code changes
- **Volume mounting**: Local code is mounted into containers for live development
- **Persistent data**: Database and user data stored in `~/.phenex/` directory

### File Structure

```
~/.phenex/                          # PhenEx data directory (auto-created)
├── data/phenex/cohorts/           # Cohort definitions
├── data/phenex/users/             # User data
└── volumes/db/data/               # PostgreSQL data
```

### Stopping the Application

```bash
# Stop all services (keeps data)
docker compose down

# Stop and remove all data (complete reset)
docker compose down -v --remove-orphans
```

## 📦 Services Overview

| Service      | Purpose                              | Port | Health Check | Container Name    |
| ------------ | ------------------------------------ | ---- | ------------ | ----------------- |
| `backend`    | FastAPI backend with PhenEx library  | 8000 | Manual       | phenex-backend    |
| `frontend`   | React/Vite development server        | 5173 | Manual       | phenex-frontend   |
| `db`         | PostgreSQL database                  | 5432 | Automatic    | phenex-db         |
| `migrations` | Database migration runner (one-time) | N/A  | Automatic    | phenex-migrations |
| `adminer`    | Database administration interface    | 8080 | Manual       | phenex-adminer    |

## 🗃️ Data Persistence

- **PostgreSQL data**: `~/.phenex/volumes/db/data/` (host directory)
- **Cohort data**: `~/.phenex/data/phenex/cohorts/` (host directory)
- **User data**: `~/.phenex/data/phenex/users/` (host directory)

## 🏢 Data Warehouse Support

The PhenEx UI currently supports **Snowflake** as the primary data warehouse backend. However, the underlying PhenEx library is built on [Ibis](https://ibis-project.org/), which provides support for many different data backends including:

- Snowflake (currently supported in UI)
- BigQuery
- Redshift
- Databricks
- PostgreSQL
- DuckDB
- And many more...

**Need another data warehouse?** Since PhenEx uses Ibis under the hood, adding support for additional Ibis-compatible backends is straightforward. Please create a GitHub issue requesting the specific backend you need, and we can work on adding UI support for it.

## 🔍 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 5173, 8000, 8080, 5432 are available
2. **Database connection**: Check PostgreSQL is running and credentials are correct
3. **Authentication issues**: Verify Azure AD configuration or JWT secrets
4. **Memory issues**: Docker requires sufficient RAM (4GB+ recommended)
5. **Permission errors**: Ensure Docker has permission to mount volumes in `~/.phenex/`
6. **Migration failures**: Check database connectivity and migration logs

### Logs and Debugging

```bash
# View logs for all services
docker compose logs

# View logs for specific service
docker compose logs backend

# Follow logs in real-time
docker compose logs -f frontend

# Check migration logs
docker compose logs migrations
```

### Reset Everything

If you encounter persistent issues:

```bash
# Complete reset (removes all data!)
docker compose down -v --remove-orphans
rm -rf ~/.phenex/  # Optional: Remove all PhenEx data
docker compose up -d
```

### Backend API Testing

Test the backend API directly:

```bash
# Check API health
curl http://localhost:8000/health

# View API documentation
# Open http://localhost:8000/docs in your browser
```

## 📚 Related Documentation

- [Main PhenEx Documentation](https://bayer-group.github.io/PhenEx)

## 🤝 Contributing

Please see the main [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to PhenEx.

## 📄 License

This project is licensed under the same terms as the main PhenEx project. See [LICENSE](../LICENSE) for details.
