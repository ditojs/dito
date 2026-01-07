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

## CSS Architecture

Dito Admin and UI packages use strict BEM methodology:

### Naming Convention
- **Blocks**: `.dito-[block]` (e.g., `.dito-button`, `.dito-table`)
- **Elements**: `.dito-[block]__[element]` (e.g., `.dito-label__prefix`)
- **Modifiers**: `.dito-[block]--[modifier]` (e.g., `.dito-buttons--large`)

### State Representation
State is always represented through block-specific modifiers:
- `.dito-menu__link--active` (not `.dito-active`)
- `.dito-pulldown--open` (not `.dito-open`)
- `.dito-container--disabled` (not `.dito-disabled`)
- `.dito-input--focus` (not `.dito-focus`)
- `.dito-button--selected` (not `.dito-selected`)

### Utilities (Exceptions to BEM)
Only these classes remain as utilities:
- `.dito-scroll`, `.dito-scroll-parent` - Scroll container infrastructure
- `.dito-layout--vertical`, `.dito-layout--horizontal` - Layout direction

**Why these remain as utilities:**
- Same behavior everywhere (no per-block overrides or variations)
- Well-defined contracts (infrastructure patterns)
- Single responsibility (manage specific cross-cutting concerns)
- No coupling or specificity issues

All other styling uses strict BEM. No shared utilities with overrides.

### Schema-Driven Classes
Schema values map to CSS modifiers programmatically:
- `layout: 'horizontal'` → `.dito-layout--horizontal`
- `padding: 'nested'` → `.dito-pane--padding-nested`
- Column names → `.dito-column--{name}`, `.dito-cell--{name}`

### Component Width Modifiers
Width/flex behavior is block-specific:
- `.dito-component--fill`, `.dito-component--grow`, `.dito-component--shrink`
- `.dito-label--fill`, `.dito-label--grow`, `.dito-label--shrink`
- `.dito-select--fill`

Managed via `getLayoutClasses(prefix)` helper method in DitoContainer.

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