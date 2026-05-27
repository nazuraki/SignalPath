# SignalPath — local dashboard that unifies Jira, GitHub, Argo, and Grafana for a single work stream

# Show available recipes
default:
    @just --list

# Install npm dependencies
install:
    npm install

# Create local config from example (idempotent)
init:
    @test -f config.toml || (cp config.example.toml config.toml && echo "created config.toml — fill in jira.email + jira.api_token before running")

# Run API server and Vite dev server together (http://localhost:5173)
dev:
    npm run dev

# Run API server only
devserver:
    npm run dev:server

# Run Vite client only
devclient:
    npm run dev:client

# Build client bundle to ./dist
build:
    npm run build

# Run production mode: built client served by the API process
run: build
    npm start

# Alias for run (kept for muscle memory)
start: run

# Run Biome lint + format check
lint:
    npm run lint

# Auto-fix lint and apply formatting
fix:
    npm run lint:fix

# TypeScript typecheck (no emit)
typecheck:
    npm run typecheck

# Run tests once
test:
    npm test

# Watch-mode tests
testwatch:
    npm run test:watch

# Run everything CI runs: lint, typecheck, test, build
check: lint typecheck test build

# Build Docker image
docker-build:
    docker build -t signalpath:latest .

# Run Docker container (detached, via compose — mounts config.toml + data/)
docker-run:
    docker compose up -d --build

# Stop and remove the Docker container
docker-stop:
    docker compose down

# Tail Docker container logs
docker-logs:
    docker compose logs -f

# Remove build artifacts and installed deps
clean:
    rm -rf dist node_modules

# Clean and reinstall from scratch
fresh: clean install

# Hit the API endpoints against a running dev server (port 3001)
ping:
    @curl -fsS http://localhost:3001/api/config | head -c 400 && echo
