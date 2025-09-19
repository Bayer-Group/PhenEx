set -e

export CONTAINER_ID=$(docker ps --format json | jq -r 'select(.Names == "phenex-db") | .ID')
export CONTAINER_NETWORK=$(docker ps --format json | jq -r 'select(.Names == "phenex-db") | .Networks')

docker exec -i -u postgres "$CONTAINER_ID" psql -d postgres -c 'DROP DATABASE phenex' || true
docker exec -i -u postgres "$CONTAINER_ID" psql -d postgres -c 'CREATE DATABASE phenex' || true

docker run --rm -v "$(pwd)/backend/migrate:/migrations" --network "${CONTAINER_NETWORK}" migrate/migrate:4 \
   -database 'postgres://postgres:password-phenex@phenex-db/phenex?sslmode=disable' \
   -path=/migrations/ up
