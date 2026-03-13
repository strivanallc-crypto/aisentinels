# Test Strategy

## Pre-Push Gate
`pnpm web:typecheck` must exit 0 before every push. No exceptions.

## Test Commands
```bash
# TypeScript type checking (REQUIRED before push)
pnpm web:typecheck

# Run all tests
pnpm test

# Run specific test file
pnpm test -- --grep 'test description'

# Run tests for a specific package
pnpm --filter @aisentinels/web test
```

## Test Patterns

### Unit Tests
- Test individual functions and utilities in isolation
- Mock external dependencies (API calls, database)
- Keep tests fast — under 5 seconds per file

### Integration Tests
- Test API route handlers with mocked services
- Verify auth middleware correctly validates JWT
- Test sentinel API integrations with mocked responses

### Auth Tests
- Verify Cognito token exchange flow
- Test session management and token refresh
- Validate JWT presence in sentinel API calls
- Test error handling for expired/invalid tokens

## Coverage Requirements
- All new features must include tests
- Auth-related changes require both unit and integration tests
- Sentinel API integrations require mocked response tests

## CI Gates
1. TypeScript compilation: `pnpm web:typecheck`
2. Linting: ESLint/Prettier
3. Unit tests: All must pass
4. Build: `pnpm build` must succeed

## Rules
- Run tests after EVERY file change, not just at the end
- Test the specific area you changed, not the entire suite (saves time and tokens)
- If a test fails, fix it before moving to the next file
- Never skip tests to "fix later"
