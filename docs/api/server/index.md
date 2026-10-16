# @ditojs/server

```js
import { Application, Model, ModelController } from '@ditojs/server'
```

The server framework: a [Koa](https://koajs.com/) application with
[Objection.js](https://vincit.github.io/objection.js/) models, REST
controllers derived from them, services, file storages and JSON schema
validation. The package has one entry point, `@ditojs/server`, with its
TypeScript types; deep imports aren't supported.

Everything not listed here is internal. Members marked *Hook* are meant to be
overridden in subclasses; *Hook, call `super`* means that overrides have to
call the inherited method. The [server guide](../../guide/server/index.md)
explains the concepts; these pages list the members.

## Pages

- [Application](application.md): the application, its configuration and
  lifecycle, and the `dito` command.
- [Model](model.md): model definitions, static and instance members, and
  the mixins for timestamps, users, sessions and asset records.
- [QueryBuilder](query-builder.md): scopes, filters, `find()`, graphs.
- [Controllers](controllers.md): actions, parameters, authorization, and the
  model, relation, users and admin controllers.
- [Service](service.md): application services.
- [Storage](storage.md): file storages and asset files.
- [Validator](validator.md): schemas, keywords, formats and types.
- [Errors](errors.md): the errors sent as responses.

## Classes

| Export                                          | Description                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| [`Application`](application.md)                 | The server application and its configuration.                      |
| [`Model`](model.md)                             | The base class of models.                                          |
| [`QueryBuilder`](query-builder.md)              | The query builder of models.                                       |
| [`Controller`](controllers.md)                  | The base class of controllers.                                     |
| [`CollectionController`](controllers.md#collectioncontroller) | The base of model and relation controllers.          |
| [`ModelController`](controllers.md#modelcontroller) | REST controller of a model's collection, members and relations. |
| [`RelationController`](controllers.md#relationcontroller) | The controllers of a model controller's relations.                 |
| [`UsersController`](controllers.md#userscontroller) | Model controller with login, logout and session actions.           |
| [`AdminController`](controllers.md#admincontroller) | Serves the Dito.js Admin.                                          |
| [`Service`](service.md)                         | The base class of services.                                        |
| [`Storage`](storage.md), [`AssetFile`](storage.md#assetfile) | File storages and their files.                                  |
| [`Validator`](validator.md)                     | The JSON schema validator.                                         |

## Mixins and models

| Export                                                          | Description                                    |
| --------------------------------------------------------------- | ---------------------------------------------- |
| [`TimestampedMixin`, `TimestampedModel`](model.md#timestampedmixin) | `createdAt` and `updatedAt`.               |
| [`UserMixin`, `UserModel`](model.md#usermixin)                  | Users that log in with a password.             |
| [`SessionMixin`, `SessionModel`](model.md#sessionmixin)         | Session storage.                               |
| [`AssetMixin`, `AssetModel`](model.md#assetmixin)               | Asset records.                                 |

## Registries and schema

| Export                                                   | Description                                                          |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| [`QueryParameters`](query-builder.md#queryparameters)    | Handlers of the query parameters of `find()`.                        |
| [`QueryFilters`](query-builder.md#queryfilters)          | Filter types for model filters.                                      |
| [`keywords`, `formats`, `types`](validator.md)           | The built-in schema keywords, formats and types.                     |
| [`convertSchema()`](validator.md#convertschema)         | Converts a Dito.js schema to a JSON schema.                          |
| [`convertRelations()`, `convertRelation()`](model.md#relation-helpers) | Convert relation definitions to Objection.js relation mappings.      |
| [`getRelationClass()`, `isThroughRelationClass()`](model.md#relation-helpers) | Map relation type names to Objection.js relation classes.            |
| [`addRelationSchemas()`](model.md#relation-helpers)     | Adds the schemas of a model's relations to its properties.           |

## Command line

The [`dito` command](application.md#cli) runs migrations and seeds, creates
migrations from models, and starts an interactive console.

## Errors

[`ResponseError`](errors.md) and its subclasses `AssetError`,
`AuthenticationError`, `AuthorizationError`, `ControllerError`,
`DatabaseError`, `GraphError`, `ModelError`, `NotFoundError`,
`NotImplementedError`, `QueryBuilderError`, `RelationError` and
`ValidationError`.

## Types

Main TypeScript types, besides the classes above:

| Type                                                          | Description                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `ApplicationConfig`, `AdminConfig`, `ApiConfig`               | [Configuration](application.md#applicationconfig).           |
| `ApplicationServices`, `ApplicationStorages`, `KoaContextState` | Interfaces to augment for typed `app.services`, `app.storages` and `ctx.state`. |
| `ModelProperty`, `ModelProperties`, `ModelRelation`, `ModelRelations`, `ModelScope(s)`, `ModelFilter(s)`, `ModelModifier(s)`, `ModelHooks`, `ModelAsset(s)` | [Model definitions](model.md#definitions). |
| `QueryFilterTypes`                                            | Interface to augment with custom filter types.               |
| `DitoGraphOptions`, `QueryParameterOptions`                   | [Query builder](query-builder.md) options.                   |
| `ControllerAction(s)`, `ModelControllerAction(s)`, `Authorize`, `ControllerAsset(s)` | [Controller](controllers.md) definitions.  |
| `StorageConfig`, `DiskStorageConfig`, `S3StorageConfig`       | [Storage](storage.md) configurations.                        |
| `Schema`, `ParameterSchema`, `Keyword`, `Format`              | [Schemas](validator.md).                                     |
| `KoaContext`, `KoaSession`                                    | The Koa context of requests.                                 |
| `HttpMethod`                                                  | `'get' \| 'head' \| 'post' \| 'put' \| 'delete' \| 'patch' \| 'options' \| 'trace' \| 'connect'` |
| `Id`, `Page`, `SerializedModel`                               | Ids, `range` results, and the JSON of models.                |
| `FromModel`                                                   | [Instance types derived from definitions](../../guide/server/models.md#deriving-types). |

## Deprecated

| Name         | Replacement  |
| ------------ | ------------ |
| `HTTPMethod` | `HttpMethod` |
