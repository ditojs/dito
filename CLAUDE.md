# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Dito.js is a declarative web framework with two main components: **Dito.js Server** (API-driven development with Koa.js/Objection.js) and **Dito.js Admin** (Vue.js admin interface). This is a monorepo managed by Lerna and Yarn workspaces.

## Package Structure

- **packages/server/**: Server framework with models, controllers, middleware, and CLI
- **packages/admin/**: Vue.js admin interface with forms, types, and schema components  
- **packages/ui/**: Shared Vue.js UI components and styles
- **packages/utils/**: Utility functions for arrays, objects, strings, dates, etc.
- **packages/router/**: Lightweight routing library
- **packages/build/**: Shared build configuration

## Common Commands

### Development
```bash
# Install dependencies and build all packages
yarn install
yarn build

# Watch mode for all packages (development builds)
yarn watch

# Build specific package
cd packages/admin && yarn build
cd packages/ui && yarn build
```

### Testing
```bash
# Run all tests
yarn test

# Tests use Vitest with globals enabled
```

### Linting & Code Quality
```bash
# Run all linters
yarn lint

# Fix linting issues
yarn lint:fix

# Individual linters
yarn eslint
yarn stylelint  
yarn penere     # Prettier via penere
```

### Package Management
```bash
# Run command across all packages
yarn foreach run <command>

# Clean all dist directories
yarn clean
```

## Key Technologies

- **Server**: Koa.js, Objection.js, Knex.js, AJV schema validation
- **Admin/UI**: Vue 3, Vite, TipTap (rich text), Vue Router
- **Database**: Objection.js ORM with Knex.js query builder
- **Build**: Vite for frontend packages, ESLint + Stylelint + Penere (Prettier)

## Code Conventions

- **80 character line limit** enforced by ESLint
- **PascalCase** for Vue components
- **camelCase** for props and variables  
- **kebab-case** for Vue slots
- Vue attribute hyphenation disabled (use camelCase)
- Pug templates supported in Vue files
- ESM modules throughout (type: "module")

## Application Structure (for Dito.js projects)

When building applications with this framework:
```
src/
├── server/           # Server application
│   ├── models/       # Model classes
│   └── controllers/  # Controller classes
├── admin/           # Admin view declarations
└── config/          # Configuration files
migrations/          # Database migrations
seeds/              # Database seeds
```

## Development Notes

- Uses Yarn 4+ with workspaces
- Husky for pre-commit hooks with lint-staged
- TypeScript definitions available for all packages
- Supports linking to local Objection.js/Knex.js for development
- Admin package uses Vite for bundling with Vue 3 + TypeScript support