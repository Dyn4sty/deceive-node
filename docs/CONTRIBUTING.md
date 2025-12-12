# Contributing to League Deceiver

First off, thank you for considering contributing to League Deceiver! It's people like you that make League Deceiver such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](../CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find that the bug has already been reported.

When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** to demonstrate the steps
- **Describe the behavior you observed** and what behavior you expected
- **Include logs** if applicable
- **Include your environment** (OS, Node.js version, League Deceiver version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful**
- **List any alternatives you've considered**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) (latest version)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/deceive-node.git
cd deceive-node

# Install dependencies
bun install

# Run in development mode
bun run dev

# Run tests
bun run test

# Run linting
bun run lint

# Build
bun run build
```

### Project Structure

```
src/
├── index.ts              # Entry point
├── startup.ts            # Startup orchestration
├── controller.ts         # Main controller
├── types.ts              # TypeScript types
├── proxy/                # Proxy implementations
├── launcher/             # Game launcher
├── ui/                   # User interfaces
├── config/               # Configuration
└── utils/                # Utilities
```

## Style Guide

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Use async/await over raw promises

### Code Formatting

We use Prettier for code formatting. Run `bun run format` before committing.

Configuration is in `.prettierrc`:

- 2 spaces for indentation
- Single quotes
- Trailing commas in ES5 contexts
- 100 character line width

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding missing tests
- `chore`: Changes to build process or auxiliary tools

Examples:

```
feat(proxy): add support for mobile status
fix(launcher): handle spaces in Riot Client path
docs(readme): update installation instructions
```

### Testing

- Write tests for new features
- Update tests when modifying existing features
- Run `bun run test` before submitting PRs
- Aim for meaningful test coverage

## Release Process

Releases are fully automated using [release-please](https://github.com/googleapis/release-please):

### How It Works

1. Push commits to `main` using [Conventional Commits](https://www.conventionalcommits.org/) format
2. Release-please automatically creates/updates a "Release PR" with:
   - Version bump in `package.json`
   - Updated `CHANGELOG.md` with categorized changes
3. When a maintainer merges the Release PR:
   - A git tag is created automatically (e.g., `v1.1.0`)
   - GitHub Actions builds binaries for all platforms
   - Binaries are uploaded to the GitHub release

### Version Bump Rules

The version bump is determined by your commit messages:

| Commit Type                    | Version Bump          | Example                      |
| ------------------------------ | --------------------- | ---------------------------- |
| `fix:`                         | Patch (1.0.0 → 1.0.1) | `fix: handle spaces in path` |
| `feat:`                        | Minor (1.0.0 → 1.1.0) | `feat: add mobile status`    |
| `feat!:` or `BREAKING CHANGE:` | Major (1.0.0 → 2.0.0) | `feat!: redesign API`        |
| `chore:`, `docs:`, etc.        | No release            | Included in next release     |

### Commit Message Examples

```
feat(proxy): add support for mobile status
fix(launcher): handle spaces in Riot Client path
docs(readme): update installation instructions
perf: improve startup time by 50%
chore: update dependencies
```

For breaking changes, add `!` after the type or include a `BREAKING CHANGE:` footer:

```
feat!: redesign configuration API

BREAKING CHANGE: Config file format has changed. See migration guide.
```

## Getting Help

- Check the [FAQ](FAQ.md)
- Search existing [issues](https://github.com/Dyn4sty/deceive-node/issues)
- Open a new issue if needed

## Recognition

Contributors are recognized in:

- The GitHub contributors page
- Release notes when their changes are included

Thank you for contributing! 🎉
