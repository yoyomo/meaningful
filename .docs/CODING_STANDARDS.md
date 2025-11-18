# Coding Standards & Policies

This document outlines the coding standards, style preferences, and development policies for the Meaningful project.

## Code Style

### JavaScript/TypeScript

- **Arrow Functions**: Enforced by ESLint - always use arrow functions: `const fn = () => {}`
- **Formatting**: Use `make format` to auto-format all code
- **TypeScript**: Strict mode enabled - use proper types for all code

### Python

- Follow PEP 8 style guidelines
- Use type hints where applicable

## Component Architecture

### React Components

- **Size Limit**: Keep components under 200-300 lines when possible
- **Maximum**: If a component exceeds 400 lines, it must be broken down
- **Single Responsibility**: Each component should have one clear purpose
- **Co-location**: React Query hooks should live in the components that use them
- **Props**: Pass minimal identifiers (e.g., `userId`), not entire query objects

### Component Organization

```
components/
  ui/              # Shared, reusable UI components (Button, Card, Input, etc.)
  domain/          # Domain-specific components (FriendCard, ContactCard, etc.)
  feature/         # Feature sections (ProfileSection, FriendsSection, etc.)
```

### Reusable Components

- Create shared components for common UI patterns
- Use consistent Tailwind classes through shared components
- Export via `index.ts` for clean imports
- Location: `components/ui/` directory

## Data Fetching

- **Co-location Principle**: Data fetching hooks should be in the component that uses the data
- **Don't Pass Queries**: If a component needs data, it should fetch it itself
- **Minimal Props**: Only pass `userId` or minimal identifiers, not entire query objects

```tsx
// ❌ Bad: Passing queries from parent
<ProfileSection profileQuery={profileQuery} onUpdate={handleUpdate} />

// ✅ Good: Component fetches its own data
<ProfileSection userId={user.id} />
```

## Code Quality Standards

### Checklist

- [ ] No component over 400 lines
- [ ] React Query hooks co-located with components that use them
- [ ] Shared UI components used consistently
- [ ] No duplicate styling/classes
- [ ] Clear component hierarchy
- [ ] Each component has single responsibility
- [ ] Easy to find and modify code
- [ ] Arrow functions used consistently
- [ ] Code formatted with `make format`

## Component Development

See [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) for detailed component development guidelines.

### Key Principles

- **Readability > Cleverness**
- **Small, focused components > Large, complex ones**
- **Co-location > Prop drilling**
- **Reusability > Duplication**

## Development Workflow

### Formatting

```bash
make format  # Auto-format all code
```

### Linting

```bash
make lint    # Run all linters
```

### Testing

```bash
make test    # Run all tests
```

## Project Structure

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

## Documentation

- Keep README files focused on setup and quick start
- Move detailed coding policies to `docs/` folder
- Update this document when new standards are established

