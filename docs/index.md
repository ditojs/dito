# Dito.js documentation

Dito.js is a declarative web framework. You describe your data as models, how
clients reach it as controllers, and how editors work with it as admin views
and forms. Dito.js turns these descriptions into a REST API and an admin
interface.

It has two main parts:

- **Dito.js Server** (`@ditojs/server`): models, controllers, validation,
  storages and services on top of Koa.js, Objection.js and Knex.js.
- **Dito.js Admin** (`@ditojs/admin`): a Vue.js admin interface built from
  schemas that describe views, lists and forms.

Both share `@ditojs/utils`, and the admin builds on the components of
`@ditojs/ui`.

## Guide

Start here to learn how the pieces fit together.

### Server

- [Introduction and installation](guide/server/index.md)
- [Configuration](guide/server/configuration.md)
- [Application](guide/server/application.md)
- [Models](guide/server/models.md), [relations](guide/server/relations.md)
  and [queries](guide/server/queries.md)
- [Controllers](guide/server/controllers.md)
- [Validation](guide/server/validation.md)
- [Errors](guide/server/errors.md)
- [Storages and assets](guide/server/storages.md)
- [Services](guide/server/services.md)
- [Migrations and seeds](guide/server/database.md)

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
- [Custom types](guide/admin/custom-types.md)

## Recipes

Short solutions to common tasks: [Recipes](recipes/index.md).

## API reference

Every public class, function and schema option:
[API reference](api/index.md).

## Upgrading

Coming from 3.x? See [Upgrading to 4.x](upgrading-to-4.x.md).
