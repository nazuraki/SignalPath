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
dev-server:
    npm run dev:server

# Run Vite client only
dev-client:
    npm run dev:client

# Build client bundle to ./dist
build:
    npm run build

# Run production mode: built client served by the API process
start: build
    npm start

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
test-watch:
    npm run test:watch

# Run everything CI runs: lint, typecheck, test, build
check: lint typecheck test build

# Remove build artifacts and installed deps
clean:
    rm -rf dist node_modules

# Hit the API endpoints against a running dev server (port 3001)
ping:
    @curl -fsS http://localhost:3001/api/config | head -c 400 && echo
