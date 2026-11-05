# Dito.js documentation

Dito.js is a declarative web framework. You describe your data as models, how
clients reach it as controllers, and how editors work with it as admin views
and forms. Dito.js turns these descriptions into a REST API and an admin
interface.

It has two main parts:

- **Dito.js Server** (`@ditojs/server` and its packages): controllers,
  authorization, validation and errors, built on [Hono](https://hono.dev). Its
  packages add MikroORM entities (`@ditojs/mikro`), storages, users and
  sessions.
- **Dito.js Admin** (`@ditojs/admin`): a Vue.js admin interface built from
  schemas that describe views, lists and forms.

Both share `@ditojs/utils`, and the admin builds on the components of
`@ditojs/ui`.

## Guide

Start here to learn how the pieces fit together.

### Server

- [Introduction and installation](guide/server/index.md)
- [API](guide/server/api.md)
- [Controllers](guide/server/controllers.md)
- [Entities and controllers](guide/server/mikro.md) and
  [writes](guide/server/writes.md)
- [Validation](guide/server/validation.md)
- [Storages and files](guide/server/storage.md)
- [Users and sessions](guide/server/auth.md)
- [Serving the admin](guide/server/admin.md)

### Admin

- [Getting started](guide/admin/index.md)
- [Views](guide/admin/views.md), [forms](guide/admin/forms.md),
  [lists](guide/admin/lists.md)
- [Fields](guide/admin/fields.md) and [buttons](guide/admin/buttons.md)
- [Form layout](guide/admin/layout.md): sections, panels and tabs
- [Context](guide/admin/context.md)
- [Events](guide/admin/events.md)
- [Validation](guide/admin/validation.md)
- [Dirty state](guide/admin/dirty-state.md)
- [Nested forms](guide/admin/nested-forms.md)
- [Dialogs](guide/admin/dialogs.md)
- [Clipboard](guide/admin/forms.md#clipboard)
- [Forms with properties and widgets](guide/admin/widgets.md)
- [Custom types](guide/admin/custom-types.md)

## Recipes

Short solutions to common tasks: [Recipes](recipes/index.md).

## API reference

Every public class, function and schema option:
[API reference](api/index.md).

## Upgrading

To upgrade from 6.x, see [Upgrading to 7.x](upgrading-to-7.x.md). It also
serves as the release notes of Dito.js 7. For older versions, see
[Upgrading to 4.x](upgrading-to-4.x.md), [5.x](upgrading-to-5.x.md) and
[6.x](upgrading-to-6.x.md).
