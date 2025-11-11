.PHONY: help setup install clean dev-frontend dev-backend dev build-frontend build-backend deploy test lint format check-deps

# Default target
help: ## Show this help message
	@echo "🚀 Meaningful App - Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Setup and Installation
setup: ## Initial project setup (install all dependencies)
	@echo "🚀 Setting up Meaningful app..."
	@echo "📦 Installing frontend dependencies..."
	@cd frontend && pnpm install
	@echo "🐍 Installing backend dependencies with SAM..."
	@cd backend && sam build
	@echo "✅ Setup complete!"
	@echo ""
	@echo "📋 Next steps:"
	@echo "  make dev-frontend  # Start frontend dev server"
	@echo "  make dev-backend   # Start backend API locally"
	@echo "  make dev          # Start both frontend and backend"

install: setup ## Alias for setup

# Development
dev: ## Start both frontend and backend in development mode
	@echo "🚀 Starting full development environment..."
	@make -j2 dev-frontend dev-backend

dev-frontend: ## Start frontend development server
	@echo "⚛️  Starting frontend dev server..."
	@cd frontend && pnpm dev

dev-backend: ## Start backend API locally with SAM (Docker Compose network)
	@echo "🐍 Starting backend API locally..."
	@$(MAKE) db-local
	@cd backend && sam build && sam local start-api --docker-network meaningful-dev --port 3001 --env-vars env.json

# Build
build: build-frontend build-backend ## Build both frontend and backend

build-frontend: ## Build frontend for production
	@echo "📦 Building frontend..."
	@cd frontend && pnpm build

build-backend: ## Build backend with SAM
	@echo "🔨 Building backend..."
	@cd backend && sam build

# Deployment
deploy: ## Deploy SAM application to AWS
	@echo "☁️  Deploying SAM application to AWS..."
	@cd backend && sam deploy

deploy-guided: ## Deploy SAM application with guided setup
	@echo "☁️  Deploying SAM application (guided setup)..."
	@cd backend && sam deploy --guided

# Testing
test: ## Run all tests
	@echo "🧪 Running tests..."
	@cd frontend && pnpm test --run
	@echo "☁️  For SAM tests, use: make test-sam"

test-frontend: ## Run frontend tests
	@echo "⚛️  Running frontend tests..."
	@cd frontend && pnpm test --run

test-sam: ## Test SAM functions locally
	@echo "☁️  Testing SAM functions locally..."
	@cd backend && sam local invoke AuthFunction --event events/auth-event.json
	@cd backend && sam local invoke CalendarFunction --event events/calendar-sync-event.json

test-backend-local: ## Test backend functions locally
	@echo "🧪 Testing backend functions locally..."
	@cd backend && sam local invoke AuthFunction --event events/auth-event.json
	@cd backend && sam local invoke CalendarFunction --event events/calendar-sync-event.json

# Code Quality
lint: ## Run linters for both frontend and backend
	@echo "🔍 Running linters..."
	@cd frontend && pnpm lint
	@cd backend && flake8 src/ --max-line-length=88 --extend-ignore=E203,W503

lint-frontend: ## Run frontend linter
	@echo "⚛️  Linting frontend..."
	@cd frontend && pnpm lint

lint-backend: ## Run backend linter
	@echo "🐍 Linting backend..."
	@cd backend && flake8 src/ --max-line-length=88 --extend-ignore=E203,W503

format: ## Format code for both frontend and backend
	@echo "💅 Formatting code..."
	@cd frontend && pnpm prettier --write src/ && pnpm lint --fix
	@cd backend && black src/ --line-length=88

format-frontend: ## Format frontend code
	@echo "⚛️  Formatting frontend..."
	@cd frontend && pnpm prettier --write src/

format-backend: ## Format backend code
	@echo "🐍 Formatting backend..."
	@cd backend && black src/ --line-length=88

# Utilities
clean: ## Clean build artifacts and dependencies
	@echo "🧹 Cleaning build artifacts..."
	@cd frontend && rm -rf dist/ node_modules/.cache/
	@cd backend && rm -rf .aws-sam/ __pycache__/ *.pyc
	@echo "✅ Clean complete!"

clean-all: ## Clean everything including node_modules
	@echo "🧹 Deep cleaning..."
	@cd frontend && rm -rf dist/ node_modules/ pnpm-lock.yaml
	@cd backend && rm -rf .aws-sam/ __pycache__/ *.pyc .pytest_cache/
	@echo "✅ Deep clean complete!"

check-deps: ## Check for dependency updates
	@echo "🔍 Checking for dependency updates..."
	@cd frontend && pnpm outdated
	@echo "🐍 Check backend dependencies in src/requirements.txt manually"

update-deps: ## Update dependencies
	@echo "⬆️  Updating dependencies..."
	@cd frontend && pnpm update
	@echo "🐍 Backend dependencies updated by rebuilding with SAM..."
	@cd backend && sam build

# AWS Utilities
logs: ## View backend logs
	@echo "📋 Viewing backend logs..."
	@cd backend && sam logs -n AuthFunction --stack-name meaningful-backend --tail

validate: ## Validate SAM template
	@echo "✅ Validating SAM template..."
	@cd backend && sam validate

# Database
db-local: ## Start local DynamoDB via Docker Compose
	@echo "🗄️  Starting local DynamoDB (docker compose)..."
	@mkdir -p backend/docker/dynamodb
	@cd backend && docker compose up -d dynamodb

db-local-stop: ## Stop the local DynamoDB container
	@echo "🛑 Stopping local DynamoDB..."
	@cd backend && docker compose stop dynamodb >/dev/null || true

bootstrap-db: ## Create/ensure DynamoDB tables defined in template.yaml exist locally
	@echo "🛠️  Bootstrapping DynamoDB tables from template.yaml..."
	@$(MAKE) db-local
	@cd backend && DYNAMODB_ENDPOINT=${DYNAMODB_ENDPOINT-http://localhost:8000} bash scripts/bootstrap_tables.sh template.yaml

# Preview
preview-frontend: ## Preview production build locally
	@echo "👀 Previewing frontend build..."
	@cd frontend && pnpm preview

# Environment
env-setup: ## Copy .env.dist files to .env for local development
	@echo "📝 Setting up environment files..."
	@cp frontend/.env.dist frontend/.env || echo "Frontend .env.dist not found"
	@cp backend/env.example.json backend/env.json || echo "Backend env.example.json not found"
	@echo "✅ Environment files created"
	@echo "📝 Edit frontend/.env and backend/env.json with your values"

google-setup: ## Show Google OAuth setup instructions
	@echo "🔑 Google OAuth Setup Required"
	@echo ""
	@echo "1. Go to: https://console.cloud.google.com/"
	@echo "2. Create project → Enable APIs (Calendar, People)"  
	@echo "3. Create OAuth credentials"
	@echo "4. Set environment variables"
	@echo ""
	@echo "📖 Full instructions: cat GOOGLE_OAUTH_SETUP.md"
	@echo ""
	@echo "🚀 After setup, run: make dev"

# Status
status: ## Show development status
	@echo "📊 Development Status:"
	@echo "Frontend: $(shell cd frontend && pnpm --version 2>/dev/null && echo "Ready" || echo "Not installed")"
	@echo "Backend: $(shell cd backend && python --version 2>/dev/null && echo "Ready" || echo "Not installed")"
	@echo "SAM CLI: $(shell sam --version 2>/dev/null && echo "Ready" || echo "Not installed")"
	@echo "AWS CLI: $(shell aws --version 2>/dev/null && echo "Ready" || echo "Not installed")"