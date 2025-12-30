# Contributing to Anchor SDK

Thank you for your interest in contributing to Anchor SDK! This document provides guidelines for contributing.

## What Can Be Contributed?

### Welcome Contributions

- SDK improvements (bug fixes, new features)
- Documentation improvements
- Example code, integration examples
- Test coverage
- Performance optimizations

### Not in This Repo

- Server implementation
- Core algorithms
- Database schema
- Admin tools

## Getting Started

1. **Fork the repository**

2. **Clone your fork:**
   ```bash
   git clone https://github.com/anchorco/anchor-sdk.git
   cd anchor-sdk
   ```

3. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes**
- Follow existing code style and conventions.
- Keep commits focused and descriptive.

5. **Test your changes**
- Ensure all existing tests pass.
- Add new tests for new features.

6. **Submit a pull request**
- Describe the change(s) you made.
- State the problem it solves (or feature it adds).
- Reference relevant issue (if applicable) and include test details.

## Development Setup

### Python SDK

```bash
cd python-sdk
pip install -e ".[dev]"
pytest
```

### TypeScript SDK

```bash
cd typescript-sdk
npm install
npm test
```

## Code Style

### Python
- Follow PEP 8
- Use type hints
- Run `black` for formatting
- Run `mypy` for type checking

### TypeScript
- Follow ESLint rules
- Use TypeScript strict mode
- Run `prettier` for formatting

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Submit PR with clear description

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
