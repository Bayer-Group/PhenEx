#!/bin/bash
set -e

# Database initialization script
# This runs automatically when PostgreSQL container starts via docker-entrypoint-initdb.d

# Get database name from environment variable or use default
DB_NAME="${POSTGRES_DB:-phenex}"

echo "🗄️  Initializing application database: $DB_NAME"

# Create the database using psql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create application database if it doesn't exist
    SELECT 'CREATE DATABASE $DB_NAME'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
EOSQL

echo "✅ Database '$DB_NAME' initialization completed"