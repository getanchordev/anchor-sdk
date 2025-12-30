# Testing Guide

## Running Tests

### Unit Tests (Mocked)

Unit tests use mocked HTTP requests and don't require a running server:

```bash
npm test
# or
npm run test:unit
```

### Integration Tests (Real Server)

Integration tests run against a real Anchor API server. They require:

1. **A running Anchor server** (local or remote)
2. **API URL configuration** (see below)

```bash
# Run integration tests
npm run test:integration

# Or with custom API URL
ANCHOR_BASE_URL=http://localhost:5050 npm run test:integration
```

## Configuring API URL

The integration tests use the `ANCHOR_BASE_URL` environment variable to determine which server to test against.

### Option 1: Environment Variable (Recommended)

```bash
# For local development
# For local development
export ANCHOR_BASE_URL=http://localhost:5050

# Production (default)
export ANCHOR_BASE_URL=https://api.getanchor.dev

# Then run tests
npm run test:integration
```

### Option 2: Inline with Command

```bash
# One-time use
ANCHOR_BASE_URL=http://localhost:5050 npm run test:integration
```

### Option 3: .env File (Not Currently Supported)

Currently, the tests don't automatically load `.env` files. You can use a tool like `dotenv-cli`:

```bash
npm install --save-dev dotenv-cli
# Then in package.json:
"test:integration": "dotenv -e .env jest client.integration.test.ts"
```

## Default Behavior

- **Default URL**: `https://api.getanchor.dev` (if `ANCHOR_BASE_URL` is not set)
- **Server Check**: Tests automatically check if the server is available before running
- **Skip on Failure**: If the server is unavailable, tests are skipped (not failed)

## Test Structure

- **Unit Tests**: `src/__tests__/client.test.ts` - Mocked HTTP, fast, no server needed
- **Exception Tests**: `src/__tests__/exceptions.test.ts` - Error handling, mocked
- **Integration Tests**: `src/__tests__/client.integration.test.ts` - Real server, requires API

## Troubleshooting

### Tests fail with "Server not available"

1. Check if your server is running: `curl https://api.getanchor.dev/health` (or `curl http://localhost:5050/health` for local)
2. Verify the URL: `echo $ANCHOR_BASE_URL`
3. Check network connectivity if using remote server

### Tests fail with authentication errors

Integration tests automatically create test users and workspaces. If you see auth errors:
- Check that the server's authentication endpoints are working
- Verify the server allows user signup (`/auth/signup`)

### Want to skip integration tests?

```bash
npm test -- --testPathIgnorePatterns=integration
```

