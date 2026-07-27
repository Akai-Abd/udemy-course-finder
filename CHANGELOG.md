# Changelog

## [1.0.3] - 2026-07-27

### Bug Fixes

- Fix error logging during embedding pipeline initialization
- Fix `start:prod` script path to point to `dist/src/main`
- Fix port-clearing commands in README to prevent script termination on empty process hits
- Fix merge conflict in README.md

### Refactoring

- Unify active coupon filtering, optimize recommendation logic, and clean up search parameters
- Simplify application bootstrap process in `main.ts`

### Chores

- Update build configuration to disable out-dir deletion and enable source maps in dev mode
- Exclude build artifacts, test files, and prisma databases from tsconfig compilation
- Update entry point configuration in `main.ts`
- Add environment template and update prisma seed script to use ts-node

### Documentation

- Overhaul installation guide with detailed prerequisites, setup modes, and troubleshooting steps
- Add troubleshooting guide for port conflicts, API access, and embedding initialization issues
- Add `npx kill-port` commands to troubleshooting guide for port management
- Update build prerequisites and installation instructions for onnxruntime-node embedding integration
- Add frontend `.env.example` and update installation & troubleshooting guide
- Update installation instructions with npm lifecycle script approval and Prisma generation steps
- Update README with build verification steps and production server instructions
- Add documentation for handling interactive Prisma database push prompts

## [1.0.2] - 2026-07-27

### Features

- Add pagination, language filtering, and app icon support
- Implement user notification preferences, password visibility toggles, and admin user management interface
- Add MIT license, upgrade to Next.js 16, and document project architecture and features

### Documentation

- Create production requirements document for Udemy Course Finder
