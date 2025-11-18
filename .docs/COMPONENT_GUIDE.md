# Component Development Guide

This guide outlines best practices for building and organizing React components in the Meaningful project. Follow these principles for all component development, not just when refactoring.

## Core Principles

### 1. **Component Size & Readability**
- **Target**: Keep components under 200-300 lines when possible
- **Break down**: If a component exceeds 400 lines, extract logical sections into separate components
- **Single Responsibility**: Each component should have one clear purpose

### 2. **Reusable UI Components**
- **Create shared components** for common UI patterns:
  - Buttons (with variants: primary, secondary, text, danger)
  - Cards (with variants: default, dashed)
  - Inputs (with label, error, helper text support)
  - Spinners, StatusMessages, Headers, etc.
- **Location**: Place in `components/ui/` directory
- **Styling**: Use consistent Tailwind classes through shared components
- **Export**: Create `index.ts` for clean imports

### 3. **Data Fetching & State Management**
- **Co-location**: React Query hooks should live in the components that use them
- **Don't pass queries down**: If a component needs data, it should fetch it itself
- **Props**: Only pass `userId` or minimal identifiers, not entire query objects
- **Example**: 
  ```tsx
  // ❌ Bad: Passing queries from parent
  <ProfileSection profileQuery={profileQuery} onUpdate={handleUpdate} />
  
  // ✅ Good: Component fetches its own data
  <ProfileSection userId={user.id} />
  ```

### 4. **Component Organization**

```
components/
  ui/              # Shared, reusable UI components (Button, Card, Input, etc.)
  domain/          # Domain-specific components (FriendCard, ContactCard, etc.)
  feature/         # Feature sections (ProfileSection, FriendsSection, etc.)
```

### 5. **Extraction Patterns**

#### Extract when you see:
- Repeated JSX patterns → Create reusable component
- Large sections (>100 lines) → Extract to separate component
- Complex logic mixed with UI → Extract logic to custom hook or separate component
- Multiple responsibilities → Split into focused components

#### Example Structure:
```tsx
// Large component (732 lines) → Break down:
HomeDashboard.tsx (77 lines)
  ├── WelcomeSection.tsx
  ├── ProfileSection.tsx (manages its own queries)
  ├── FriendsSection.tsx (manages its own queries)
  └── AvailabilityCard.tsx
```

### 6. **Props & Interfaces**
- **Minimal props**: Pass only what's necessary (usually just `userId`)
- **Avoid prop drilling**: If data is needed, fetch it where it's used
- **Type safety**: Use TypeScript for all props

### 7. **Code Quality Checklist**
- [ ] No component over 400 lines
- [ ] React Query hooks co-located with components that use them
- [ ] Shared UI components used consistently
- [ ] No duplicate styling/classes
- [ ] Clear component hierarchy
- [ ] Each component has single responsibility
- [ ] Easy to find and modify code

## Development Process

When building new components or features:

1. **Start with structure** - Plan component hierarchy before coding
2. **Use shared UI components** - Check `components/ui/` first
3. **Co-locate data fetching** - Put React Query hooks in the component that uses the data
4. **Keep it small** - Extract if approaching 300+ lines
5. **Simplify props** - Pass minimal identifiers, not entire objects
6. **Verify** - Check linter, test functionality

## Example: Before & After

### Before (732 lines, hard to maintain):
```tsx
// HomeDashboard.tsx - everything in one file
const HomeDashboard = () => {
  const profileQuery = useProfile(userId)
  const friendsQuery = useFriends(userId)
  // ... 700+ more lines of mixed logic and UI
}
```

### After (77 lines, clean and maintainable):
```tsx
// HomeDashboard.tsx - just composition
const HomeDashboard = () => {
  return (
    <>
      <WelcomeSection />
      <ProfileSection userId={user.id} />  // Manages own queries
      <FriendsSection userId={user.id} />  // Manages own queries
    </>
  )
}
```

## Remember
- **Readability > Cleverness**
- **Small, focused components > Large, complex ones**
- **Co-location > Prop drilling**
- **Reusability > Duplication**

