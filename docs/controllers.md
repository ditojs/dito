# Dito.js Controllers

Dito.js offers a selection of controller base classes through which a Dito.js
application defines its own controllers.

Controllers are defined by extending these base classes and giving them the
desired behavior through code and configuration objects defined on the class
instance. These classes are then passed as arguments when creating the
[Application](docs/application.md) instance.

The application automatically handles their creation and registration, as well
as their mapping to namespaces and setting up of the their routes, hence the
code of a Dito.js application doesn't need to concern itself with the
instantiation of controllers.

## Actions

In their definition, all Dito.js controllers can provide actions which are the
functions to be called when their route is requested. Actions specify the HTTP
method to which they should respond to, as well as the paths to which they are
mapped, defined as a sub-path relatively to the route path of their controller.

Actions are named using a convention that specifies both the method and the path
in their name: `'<method> <path>'`. A special case are the default actions on
the controller path, which only specify the method: `'<method>'`.

Actions can also define mappings and validation schemas for their parameters and
return values, provided in the same format as is used for model properties,
mapping the query or body parameters passed to an action method and the value
returned from it, and triggering their automatic validation.

All Dito.js actions receive the full
[Koa.js `ctx` object](http://koajs.com/#context) as their first argument.

```js
'get say-hello'(ctx) {
  return `Just sayin' hello: ${ctx.query.message}`
}
```

### Example

```js
import { Controller } from '@ditojs/server'

export class GreetingsController extends Controller {
  // Providing the controller path is optional, a default is deducted from
  // the normalized class name otherwise, with the same result in this case:
  path = 'greetings'

  actions = {
    // This action will respond to GET /greetings/say-hello
    'get say-hello'() {
      return 'Hello!'
    },

    'get say-named-hello': {
      parameters: {
        name: {
          type: 'string'
        }
      },
      handler(ctx, { name }) {
        return `Hello there, ${name}!`
      }
    },

    'get say-goodbye': {
      returns: {
        type: 'string'
      },
      handler() {
        return 'Goodbye, and thank you for stopping by!'
      }
    }
  }
}
```

## Action Settings

Dito.js supports various settings to configure the controller actions. The
simplest version provides the action handler function directly as the action's
value, e.g.:

```js
'get values'() {
  return [1, 2, 3]
}
```

For further configuration, e.g. to specify parameters validation, an object with
further properties can be provided instead:

```js
'get values-multiplied': {
  parameters: {
    factor: {
      type: 'number'
    }
  },
  handler(ctx, { factor }) {
    return [1 * factor, 2 * factor, 3 * factor]
  }
}
```

Default actions can be defined by only providing the method name:

```js
get: {
  returns: ({
    type: 'string'
  },
  handler() {
    return 'Hello from the index action.'
  }
}
```

### `action.handler`

In action object notation, `action.handler` provides the action function to be
called when the action's route is requested. It receives [Koa.js `ctx`
object](http://koajs.com/#context) as its first argument, followed by an object
containing all parameters, if `action.parameters` validation is provided:

### `action.parameters`

The `action.parameters` setting can be used if automatic mapping of Koa.js'
`ctx.query` or `ctx.body` objects to method parameters is desired, along with
their automatic validation. To do so, set it to an object containing each
parameter in the same format Dito.js uses for its model property schema.

Note the `type` can also be set to the name of any model known to your Dito app,
in addition to the standard types supported by JSON schema:

```js
'post do-something: {
parameters: {
  model: {
    type: 'MyModel'
  }
},
handler(ctx, { model }) {
  return `Received a validated model instance: ${model}`
}
```

For information on property schema and validation, see
[Model Properties](./model-properties.md) and [Validator](./validator.md).

The parameters are read from the `ctx.body` object for post and put requests,
all other requests read from `ctx.query`.

```js
'get say-hello': {
  parameters: {
    message: {
      type: 'string',
      required: true
    }
  },
  handler(ctx, { message }) {
    return `Just sayin' hello: ${message}`
  }
}
```

#### Receiving the full `ctx.query` as a validated parameter

If a parameter schema provides `root: true`, the full `ctx.query` object is
mapped to this parameter, and is validated against its schema:

```js
parameters: {
  query: {
    type: 'object',
    root: true,
    required: true
  }
},
'get query-something'(ctx, { query }) {
  return `Just queryin' something: ${query}`
}
```

#### Receiving the resolved `member` as a parameter

TODO: Docs

#### `action.parameters` Validation Options

In order to configure the validator used for parameters validation, an optional
`options` parameter can be provided as the second entry of an array of which the
first entry describes the parameters schema:

```js
parameters: [<schema>, <options>]
```

These validation options are supported:

| Option            | Default | Description
| ----------------- | ------- | ------------------------------------------------
| `patch`           | `false` |
| `throw`           | `true`  |
| `graph`           | `false` |
| `async`           | `false` |

In addition to these, the following Ajv validator options can also be controlled
through the `options` setting. See [Ajv](https://ajv.js.org/options.html) for
a description of their meaning:

| Option                | Default |
| --------------------- | ------- |
| `$data`               | `false` |
| `$comment`            | `true`  |
| `coerceTypes`         | `false` |
| `multipleOfPrecision` | `false` |
| `ownProperties`       | `true`  |
| `removeAdditional`    | `false` |
| `uniqueItems`         | `true` |
| `useDefaults`         | `true`  |
| `verbose`             | `false` |

```js
parameters: [{
  model: {
    type: 'MyModel',
    required: true
  }
}, {
  patch: true
}]
```

### `action.returns`

Just as `action.parameters` allows mapping and validating the parameters that
the action method receives, `action.returns` can be used to provide a schema for
the action's return value, and optionally map the value to a key inside a
returned object.

```js
'get say-hello': {
  returns: {
    type: 'string'
  },
  handler() {
    return `Greetings, received as a string value!`
  }
}
```

## Path Normalization

Dito.js uses the app-wide configuration switch `config.app.normalizePaths`
to determine if route paths should be normalized or not.

Path normalization means that the controller's name is converted with Dito.js
Utils' `hyphenate()` method, which has the same effect as Lodash's
`_.kebabCase()`: It converts the string to so called-kebab case, where
camel-cased names are separated by hyphens and all chars are lower-cased, so
`'myActionName'` turns into `'my-action-name'`.

When normalizing controller names, and the controller class name ends in
`'Controller'`, then this that is stripped off the name. So
`'GreetingsController'` is normalized to `'greetings'`.

## Namespaces

Dito.js offers a simple pattern to map controllers to namespaces: When creating
the application and passing the controllers to it in the `controllers` object,
any sub-object of it will be mapped to a namespace by its property name. Nested
controller namespace objects will be flattened by joining the properties with
the `'/'` separator.

### Example

```js
const controllers = {
  api: {
    frontend: {
      // This will be mapped to '/api/frontend/example':
      ExampleController
    },

    admin: {
      // This will be mapped to '/api/admin/example':
      ExampleController: ExampleAdminController
    }
  }
}

const app = new Application({
  config,
  controllers
})
```

Note that usually you wouldn't craft this object manually. Instead, you'd use
a pattern of nested folders and `import` / `export` statements that result in
such a structure being exported:

#### `src/controllers/index.js`:
```js
export * as api from './api/index.js'
```

#### `src/controllers/api/index.js`:
```js
export * as frontend from './frontend/index.js'
export * as admin from './admin/index.js'
```

## `Controller` Class

This is the base class for all other controller classes provided by Dito.js. It
can also be used to implement a basic controller in an application that doesn't
require mappings to a model.

every instance method declared in the controller class is automatically mapped
to an action. Static class methods aren't mapped. Decorators can be used to
configure the actions.

In addition to the action methods, the following configuration settings are
available, to be set on the controller instance.

| Instance Field             | Description
| -------------------------- | -------------------------------------------------
| `name`: `string`           | The controller's name. If not provided, it is automatically deducted from the controller class name. If this name ends in `'Controller'`, that is stripped off the name, so `'GreetingsController'` turns into `'Greetings'`. 
| `path`: `string`           | The relative path used to determine the controller's route path.
| `actions`: `Object`        | TODO: Document controller actions.

Note: While traditionally, these instance fields would have to be set in the
controller constructor, we can leverage public class fields in ECMAScript to set
instance fields in a more elegant way.

So instead of:

```js
export class GreetingsController extends Controller {
  constructor(...args) {
    super.constructor(...args)
    this.path = 'greetings'
  }
}
```

We can simply write:

```js
export class GreetingsController extends Controller {
  path = 'greetings'
}
```

## `ModelController` Class

A model controller represents a Dito.js model class, and offers access to it
on the level of both the *collection*, and its *members*. To better explain
these terms:

- *collection*: The totality of all members of a given model class. In database
  speech, this is the *table*. In JavaScript, it's an *array of instances* of
  the model class.
- *member*: A single member of a given model class. In database
  speech, this is a single *row* in the table. In JavaScript, it's a single
  *instance* of the model class.

On both levels, Dito.js provides a series of default model actions that are
activated by default and mapped to database methods and default model routes:

### Collection Actions

Collection actions are all mapped to the controller's route path (`this.path`),
and distinguished only by their methods. Here's the mapping of the methods to
the collection actions and the database methods they execute:

| HTTP Method | Collection Action | Database Method
| ----------- | ----------------- | --------------------------------------------
| `'get'`     | `get()`           | `find()`
| `'delete'`  | `delete()`        | `delete()`
| `'post'`    | `post()`          | `insertAndFetch()` or `insertDitoGraphAndFetch()`
| `'put'`     | `put()`           | `updateAndFetch()` or `updateDitoGraphAndFetch()`
| `'patch'`   | `patch()`         | `patchAndFetch()` or `patchDitoGraphAndFetch()`

### Member Actions

Member actions are all mapped to the controller's member route path (``
`${this.path}/:id` ``), and distinguished only by their methods. Here's the
mapping of the methods to the member actions and the database methods they
execute:

| HTTP Method | Member Action | Database Method
| ----------- | ------------- | ------------------------------------------------
| `'get'`     | `get()`       | `findById()`
| `'delete'`  | `delete()`    | `deleteById()`
| `'put'`     | `put()`       | `updateAndFetchById()` or `updateDitoGraphAndFetchById()`
| `'patch'`   | `patch()`     | `patchAndFetchById()` or `patchDitoGraphAndFetchById()`

In comparison to the `collection` actions, the `post()` action is missing here,
but with good reason: Inserting into an existing member is an undefined
operation.

### Graph Methods

Notice the distinction between the database methods and their `…Graph…`
counterparts. This behavior is controlled by the `graph` configuration setting,
see [Instance Fields](#modelcontroller-instance-fields) below.

For more information on graphs, see
[Model Queries – Graph Methods](./model-queries.md#graph-methods).

### Security Concerns

Please note: By default, all these actions are allowed, facilitating rapid
prototyping but leading to obvious security issues when left open in production.
Use the `allow` configuration on both the `collection` and `member` objects to
control which actions should be exposed.

### Example

```js
import { ModelController } from '@ditojs/server'
import { MyModel } from './models/index.js'

export class MyModels extends ModelController {
  modelClass = MyModel

  collection = {
    allow: ['get', 'get hello-collection'],

    'get hello-collection': {
      parameters: {
        message: {
          type: 'string',
          required: true
        }
      },
      handler(ctx, { message }) {
        return `Model class '${this.modelClass.name}' says hello: ${msg}`
      }
    }
  }

  member = {
    allow: ['get', 'get hello-member'],

    'get hello-member': {
      parameters: {
        instance: {
          member: true
        },
        message: {
          type: 'string',
          required: true
        }
      },
      returns: {
        type: 'string'
      },
      handler(ctx, { instance, message }) {
        return `Model instance '${instance.name}' says hello: ${message}`
      }
    }
  }
}
```

As you can see, in comparison to the base controller class, model controllers
add quite a few configuration settings to map these structures to model actions
in a clean way:

### Instance Fields

| Instance Field                                  | Description
| ----------------------------------------------- | ----------------------------
| `modelClass`: `function`                        | The model class that this controller represents. If none is provided, the singularized controller name is used to look up the model class in models registered with the application. As a convention, model controller names should always be provided in pluralized form.
| `collection`: `Object`                          | The object describing all the controller's collection actions. Instead of being provided on the instance level as in the controller base class, they are to be wrapped in a designated object in order to be assigned to the collection.
| `collection.allow`: `Array`                     | Just like on the base controller class, `allow` settings can also be provided on the level of the `collection` object.
| `member`: `Object`                              | The object describing all the controller's member actions. Instead of being provided on the instance level as in the controller base class, they are to be wrapped in a designated object in order to be assigned to the member.
| `member.allow`: `Array`                         | Just like on the base controller class, `allow` settings can also be provided on the level of the `member` object.
| `relations`: `Object`                           | The list of relation controller configurations, to be mapped to instances of `RelationController` that are automatically instantiated by the `ModelController`. See [`RelationController` Class](#relationcontroller-class) for details.
| `graph`: `boolean`                              | Controls whether normal database methods should be used, or their `…Graph…` counterparts. For more information on graphs, see [Model Queries – Graph Methods](./model-queries.md#graph-methods).
| `allowParam`: `string` &#124; `Array`           | The query parameter(s) allowed to be passed to the default model actions, both on `collection` and `member` level, e.g. `'scope'`, `'range'`, `'order'`. If none is provided, every supported parameter is allowed. See [Model Queries – Find Methods](./model-queries.md#find-methods) for more information on the supported query parameters.
| `allowScope`: `string` &#124; `Array`           | The scope(s) allowed to be requested when passing the `'scope'` query parameter to the default model actions. If none is provided, every supported scope is allowed. See [Model Scopes](./model-scopes.md) for more information on scopes.
| `allowFilter`: `string` &#124; `Array`           | The filter(s) allowed to be requested when passing the `'filter'` query parameter to the default model actions. If none is provided, every supported filter is allowed. See [Model Scopes](./model-filters.md) for more information on filters.
| `scope`: `string` &#124; `Array`                | The scope(s) to be applied to every query executed through this controller. See [Model Scopes](./model-scopes.md) for more information on scopes.
| `authorize`: `function` &#124; `string` &#124; `Array` &#124; `Object` | Not yet implemented.
| `cache`: `Object`                               | Not yet implemented.

### Action Inheritance

Dito.js implements a sophisticated inheritance strategy so that normal JS-style
inheritance patterns can be used on action methods declared inside actions
instance fields, such as `collection`, `member`, and even in a nested way on
`relations` and its own `relation` and `member` fields (See
[`RelationController` Class](#relationcontroller-class)).

In normal JS classes, such fields wouldn't automatically inherit from each
other, but in Dito.js Controllers, inheritance is set up for them at
instantiation time so that all actions defined in the base controllers are
inherited inside instance fields, and `super` can be used in those that override
them:

```js
import { ModelController } from '@ditojs/server'
import { MyModel } from './models/index.js'

export class MyModels extends ModelController {
  modelClass = MyModel

  collection = {
    // Let's override the default `collection.get(ctx)` method and add some
    // additional data to its returns value.
    async get(ctx) {
      const results = await super.get(ctx)
      return {
        results,
        additional: `Whatever you'd like to send back, really`
      }
    }
  }
}
```

## `RelationController` Class

Model controllers can optionally also generate routes for their relations
through the `RelationController` class. Different from the other controller
classes, the `RelationController` class will not be extended in code. Instead,
the `relations` object is provided as an instance field in the
`ModelController`, holding keys for each relation, for which the values are
again objects describing the relation actions.

Each of these relation objects are quite similar to the configuration of the
`ModelController` class itself, with the difference that the object describing
the relation's collection is not called `collection`, it is called `relation`
instead. But the relation's members' actions are again described in the `member`
object. It is not necessary to provide `modelClass` configuration settings for
relation controller, because these can automatically be deducted from the parent
model class through the provided relation name.

The other difference to `ModelController` is that `RelationController` respects
the `owner` settings of relations, and uses the `relate()` / `unrelate()`
database methods instead of `insert()` / `delete()` & co. for relations that are
not the owners of their members.

See [Model Relations](./model-relations.md) for
more information on the relation's `owner` setting.

### Example

```js
import { Model, ModelController } from '@ditojs/server'

class MyModel extends Model {
  static relations = {
    myRelation: {
      relation: 'hasMany',
      from: 'MyModel.id',
      to: 'OtherModel.myModelId',
    }
  }
}

class MyModels extends ModelController {
  modelClass = MyModel

  collection = {
    allow: ['get']
  }

  member = {
    allow: ['get']
  }

  relations = {
    myRelation: {
      relation: {
        allow: ['get']
      },
      member: {
        allow: ['get']
      }
    }
  }
}
```

## `UserController` Class

The `UserController` extends `ModelController` and provides the following
collection actions for easier handling of user authentication through
[koa-passport](https://github.com/rkusa/koa-passport), to be used in conjunction
with Dito.js' `UserModel` base-class or the `UserMixin`:

| Verb       | Collection Action | Parameters             
| ---------- | ----------------- | -----------------------
| `'post'`   | `login()`         | `username` / `password`
| `'post'`   | `logout()`        |
| `'get'`    | `current()`       |

TODO: Write about `UserModel`, `UserMixin`, and describe return values of
actions.

## `AdminController` Class

The `AdminController` extends the base `Controller` and provides a mounting
point for the Dito.js Admin interface.

During development, it runs a [vite](https://vitejs.dev/) development server
with support for hot-reloading, capable of compiling and serving the Dito.js
Admin views and forms that are automatically recompiled and reloaded on code
changes. In production, a pre-built version of these admin views and forms
is statically hosted instead.

The app-wide configuration object `config.admin` is used to determine the
location of the admin views and forms.

See [Admin](./admin.md) for more information about Dito.js Admin, and
[Configuration](./configuration.md) for a description of the available
configuration options.
