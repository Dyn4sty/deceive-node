# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1](https://github.com/Dyn4sty/deceive-node/compare/v1.0.0...v1.0.1) (2025-12-12)


### Bug Fixes

* disable ESLint rule for unsafe assignment in tray.ts ([ebc4bfb](https://github.com/Dyn4sty/deceive-node/commit/ebc4bfbfa0ff039edbd8365d54182709b41ba49e))

## [1.1.0](https://github.com/Dyn4sty/deceive-node/compare/v1.0.1...v1.1.0) (2025-12-12)

### Changed

- Migrated from Jest to Bun's native test runner for better performance
- Refactored code to use Bun's native TLS socket APIs
- Improved connection handling with data buffering to prevent race conditions
- Removed manual setup command - certificates now auto-generate on first use
- Fixed systray2 import to use default export correctly

### Removed

- Removed unused dependencies: ora, tsx, tree-kill, xml2js, jest, ts-jest
- Removed manual certificate setup command

### Fixed

- Fixed system tray initialization error with systray2 default export
- Fixed race condition where incoming data was lost before proxy connection was established

## [Unreleased]

### Added

- Initial TypeScript/Node.js port of Deceive
- Support for League of Legends, VALORANT, and Legends of Runeterra
- CLI interface with commander
- Cross-platform system tray interface
- Certificate generation and installation
- HTTPS proxy server with request interception
- Presence handler for modifying XMPP presence stanzas
- Game launcher with automatic detection
- Configuration management
- Comprehensive documentation (README, TECHNICAL_OVERVIEW, ARCHITECTURE)
- GitHub Actions workflows for CI/CD
- Issue templates and contribution guidelines
- Code of Conduct

## [1.0.0] - TBD

### Added

- Initial release
- Support for League of Legends, VALORANT, and Legends of Runeterra
- CLI and system tray interfaces
- Cross-platform support (Windows, macOS, Linux)
