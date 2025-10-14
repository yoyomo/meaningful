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
	@echo "🐍 Installing backend dependencies..."
	@cd backend && pip install -r requirements.txt -r requirements-dev.txt
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

dev-backend: ## Start backend API locally with SAM
	@echo "🐍 Starting backend API locally..."
	@cd backend && sam build --cached && sam local start-api --port 3001

# Build
build: build-frontend build-backend ## Build both frontend and backend

build-frontend: ## Build frontend for production
	@echo "📦 Building frontend..."
	@cd frontend && pnpm build

build-backend: ## Build backend with SAM
	@echo "🔨 Building backend..."
	@cd backend && sam build

# Deployment
deploy: ## Deploy backend to AWS
	@echo "🚀 Deploying to AWS..."
	@cd backend && sam deploy

deploy-guided: ## Deploy backend to AWS with guided setup
	@echo "🚀 Deploying to AWS (guided)..."
	@cd backend && sam deploy --guided

# Testing
test: ## Run all tests
	@echo "🧪 Running tests..."
	@cd frontend && pnpm test --run
	@cd backend && python -m pytest tests/ -v

test-frontend: ## Run frontend tests
	@echo "⚛️  Running frontend tests..."
	@cd frontend && pnpm test --run

test-backend: ## Run backend tests
	@echo "🐍 Running backend tests..."
	@cd backend && python -m pytest tests/ -v

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
	@cd frontend && pnpm prettier --write src/
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
	@cd backend && pip list --outdated

update-deps: ## Update dependencies
	@echo "⬆️  Updating dependencies..."
	@cd frontend && pnpm update
	@cd backend && pip install -r requirements.txt --upgrade

# AWS Utilities
logs: ## View backend logs
	@echo "📋 Viewing backend logs..."
	@cd backend && sam logs -n AuthFunction --stack-name meaningful-backend --tail

validate: ## Validate SAM template
	@echo "✅ Validating SAM template..."
	@cd backend && sam validate

# Database
db-local: ## Start local DynamoDB for testing
	@echo "🗄️  Starting local DynamoDB..."
	@docker run -p 8000:8000 amazon/dynamodb-local

# Preview
preview-frontend: ## Preview production build locally
	@echo "👀 Previewing frontend build..."
	@cd frontend && pnpm preview

# Environment
env-example: ## Create example environment files
	@echo "📝 Creating example environment files..."
	@echo "# Frontend Environment Variables" > frontend/.env.example
	@echo "VITE_API_URL=http://localhost:3001" >> frontend/.env.example
	@echo "VITE_GOOGLE_CLIENT_ID=your_google_client_id" >> frontend/.env.example
	@echo "" >> frontend/.env.example
	@echo "# Backend Environment Variables" > backend/.env.example
	@echo "GOOGLE_CLIENT_ID=your_google_client_id" >> backend/.env.example
	@echo "GOOGLE_CLIENT_SECRET=your_google_client_secret" >> backend/.env.example
	@echo "JWT_SECRET=your_jwt_secret" >> backend/.env.example

# Status
status: ## Show development status
	@echo "📊 Development Status:"
	@echo "Frontend: $(shell cd frontend && pnpm --version 2>/dev/null && echo "Ready" || echo "Not installed")"
	@echo "Backend: $(shell cd backend && python --version 2>/dev/null && echo "Ready" || echo "Not installed")"
	@echo "SAM CLI: $(shell sam --version 2>/dev/null && echo "Ready" || echo "Not installed")"
	@echo "AWS CLI: $(shell aws --version 2>/dev/null && echo "Ready" || echo "Not installed")"