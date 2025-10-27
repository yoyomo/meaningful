# Meaningful

A modern app for scheduling meaningful calls with friends.

## Project Structure

```
meaningful/
├── frontend/          # React TypeScript frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
└── backend/           # Serverless Python backend
    ├── src/
    ├── serverless.yml
    └── requirements.txt
```

## Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS for styling
- Vite for build tooling
- pnpm for package management

### Backend
- AWS Lambda (Serverless)
- Python 3.11
- DynamoDB for database
- AWS SAM (Serverless Application Model)

## Features (Planned)
- Google OAuth authentication
- Google Calendar sync
- Friend management
- Call scheduling
- Calendar integration

## Getting Started

### Quick Start with Makefile
```bash
# 1. Initial setup (installs all dependencies)
make setup

# 2. Set up Google OAuth (required for authentication)
make google-setup  # Shows setup instructions

# 3. Start development (runs both frontend and backend)  
make dev

# Or run individually
make dev-frontend  # React app at http://localhost:3000
make dev-backend   # API at http://localhost:3001
```

### Google OAuth Required
This app uses Google OAuth for authentication and calendar access. See [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) for detailed setup instructions.

### Manual Setup

#### Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

#### Backend
```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
sam build
sam local start-api --port 3001
```

### Available Make Commands
Run `make help` to see all available commands:
- `make setup` - Initial project setup
- `make dev` - Start full development environment
- `make build` - Build both frontend and backend
- `make test` - Run all tests
- `make lint` - Run all linters
- `make format` - Format all code
- `make deploy` - Deploy to AWS

### Code Style
- Arrow functions enforced by ESLint: `const fn = () => {}`
- Auto-formatting with `make format`

## Development Status
- ✅ Initial project setup
- ✅ Google OAuth authentication
- ✅ Modern React UI with Tailwind
- ✅ AWS SAM serverless backend
- 🚧 Google Calendar integration (next)
- ⏳ Call scheduling features
- ⏳ Friend management
- ⏳ AI call summaries