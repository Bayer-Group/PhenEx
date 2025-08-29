# PhenEx Application

This directory contains the full-stack web application for PhenEx, including the backend API, frontend UI, and supporting infrastructure.

## 🏗️ Architecture

The PhenEx application consists of several components:

- **Backend**: FastAPI-based REST API (`/backend`) with Python support for PhenEx phenotype extraction
- **Frontend**: React + TypeScript application (`/ui`) for interactive cohort building and data visualization
- **Database**: PostgreSQL with Supabase for authentication and data management
- **Infrastructure**: Docker Compose orchestration with supporting services (Kong API Gateway, Supabase Studio)

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

2. **Set up initial volumes**

   ```bash
   cp -r _init_volumes volumes
   ```

   This copies the initial configuration files and database schemas needed for the application to start properly.

3. **Start the application**

   ```bash
   docker compose up
   ```

   This command will:

   - Build and start all required services
   - Initialize the PostgreSQL database with PhenEx schemas
   - Start the backend API server on port 8001
   - Start the frontend development server on port 5173
   - Launch Supabase Studio for database management

### 🌐 Accessing the Application

Once all services are running (this may take a few minutes on first startup):

- **Frontend Application**: http://localhost:5173
- **Backend API**: http://localhost:8001
- **Supabase Studio**: http://localhost:54323 (database management interface)
- **API Documentation**: http://localhost:8001/docs (FastAPI Swagger docs)

## 🔧 Development

### Environment Configuration

The application uses environment variables for configuration. Key files:

- `backend/.env` - Backend API configuration (database connections, API keys)
- Root `.env` - Docker Compose environment variables

### Development Mode

The Docker Compose setup is configured for development with:

- **Hot reload**: Both frontend and backend automatically restart when code changes
- **Volume mounting**: Local code is mounted into containers for live development
- **Debug ports**: Exposed for debugging and testing

### Stopping the Application

```bash
# Stop all services
docker compose down

# Stop and remove all data (complete reset)
docker compose down -v --remove-orphans
```

## 📦 Services Overview

| Service        | Purpose                             | Port  | Health Check |
| -------------- | ----------------------------------- | ----- | ------------ |
| `backend-dev`  | FastAPI backend with PhenEx library | 8001  | Manual       |
| `frontend-dev` | React/Vite development server       | 5173  | Manual       |
| `db`           | PostgreSQL database                 | 54322 | Automatic    |
| `auth`         | Supabase Auth (GoTrue)              | -     | Automatic    |
| `meta`         | PostgreSQL metadata API             | -     | -            |
| `kong`         | API Gateway                         | 54321 | -            |
| `studio`       | Supabase Studio UI                  | 54323 | Automatic    |

## 🗃️ Data Persistence

- **Database data**: Persisted in `./volumes/db/data`

## 🔍 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 5173, 8001, 54321-54323 are available
2. **Memory issues**: Docker requires sufficient RAM (4GB+ recommended)
3. **Permission errors**: Ensure Docker has permission to mount volumes

### Logs and Debugging

```bash
# View logs for all services
docker compose logs

# View logs for specific service
docker compose logs backend-dev

# Follow logs in real-time
docker compose logs -f frontend-dev
```

### Reset Everything

If you encounter persistent issues:

```bash
# Complete reset (removes all data!)
docker compose down -v --remove-orphans
rm -rf volumes
cp -r _init_volumes volumes
docker compose up
```

## 🧪 Testing

The application includes test suites for both frontend and backend components. Tests can be run within the Docker containers or locally with appropriate dependencies installed.

## 📚 Related Documentation

- [Main PhenEx Documentation](https://bayer-group.github.io/PhenEx)
- [API Reference](../docs/api/)
- [PhenEx Library](../phenex/)

## 🤝 Contributing

Please see the main [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines on contributing to PhenEx.

## 📄 License

This project is licensed under the same terms as the main PhenEx project. See [LICENSE](../LICENSE) for details.
