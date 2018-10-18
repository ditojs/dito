# Dito.js Model Scopes

Scopes allow the definition of commonly-used queries wrapped in a function that
receives a query builder as its argument, on which it then calls the desired
query functions.

Objection.js knows a similar concept called
[`modifiers`](http://vincit.github.io/objection.js/#modifiers), and underneath,
Dito.js leverages this concept to implement its concept of scopes.  But Dito.js
scopes go further in a variety of ways. See [Differences to
Objection.js](#differences-to-objectionjs) for details.
 
Scopes are defined in the static `scopes` field, an object where the key is the
name of the scope, and the value is a function describing the query to be
executed.

The scopes can then be applied through the model's `QueryBuilder` scope
functions (see [Model Queries](./model-queries.md#scope-methods)), through the
`scope` setting on relations (see [Model Relations](./model-relations.md)) as
well as through requests to a `ModelController` that either allows scopes being
applied through queries, or directly applies them by default
(see [Controllers – ModelController](./controllers.md#modelcontroller)).

## Example

Scopes can be defined on the model like this:

```js
export class MyModel extends Model {
  static scopes = {
    default: query => query
      .orderBy('createdAt'),

    published: query => query
      .where('published', true)
      .mergeEager('someRelation(published)')
  }
}
```

The definition of the `orderBy()` statement in the `default` scopes means that
the models of this class appear ordered by default when any query is executed.
See [Default Scopes](#default-scopes) for details.

The `published` scope will list all models that have their `published` property
set to `true`, and for these it will also eager-load the models of the
`someRelation` relation, but only the ones where the `published` scope applies 
as well (using Objection.js' syntax for applying filters = scopes to [eager 
expressions](http://vincit.github.io/objection.js/#relationexpression)).

Note: `mergeEager()` merges with previously defined eager expressions whereas
`eager()` overwrites previously defined eager expressions. In scopes, it is
advised to use `mergeEager()`, so that when multiple scopes are combined,
their eager expressions get merged correctly as well.

For more information on
[eager expressions](http://vincit.github.io/objection.js/#eager), see the
Objection.js documentation.

## Eager Scopes

Scopes can be applied in two different ways: as eager scopes, or as normal
scopes. The difference between both is that eager scopes are applied not only to
the query itself, but also on any level of any eager expression that may be
requested to be loaded as a result of the query being executed.

When applying scopes normally, and the model class in question does not define
the required scope, an error is thrown. When applying scopes eagerly, they are
applied to the model queries themselves as well as on any level of the
encountered eager expressions only if the given models actually recognize them,
and no errors are thrown if the scopes are unknown.

If the application of an eager scope results in the further expansion of the
requested eager expressions, then the eager scope gets further applied to that
expanded eager expression as well, resulting in it being applied on all levels
of the final eager expression, even recursively if its application triggers
further expansions of the eager expression, etc.

This is very useful for example when wanting to implement filters for properties
that should or should not be loaded in certain situations, e.g. when editing
models through the admin interface: For such a scenario, an  `admin` scope can
be defined on any model that wants to limit the properties to be included, and
the `ModelController` class for the admin routes can then define the `scope
= '~admin'` setting, so that the `admin` scope is eagerly applied to all loaded
data whenever the models of that given model class are loaded through this
controller.

For more information on the `ModelController` class, see
[Controllers – ModelController](./controllers.md#modelcontroller)

For more information on
[eager expressions](http://vincit.github.io/objection.js/#eager), see the
Objection.js documentation.

## Default Scopes

Default scopes are defined just like any other scope, but use the reserved
`default` name. The difference to other scopes is that they get automatically
eagerly applied to any query upon their execution. See
[Eager Scopes](## Eager Scopes) to read more on eager application of scopes.

This is a very convenient way for example to define default ordering through
[`orderBy()`](http://vincit.github.io/objection.js/#orderby), or default inclusion
of properties through
[`select()`](http://vincit.github.io/objection.js/#select).

In order to avoid clashes between scopes and any special query that isnt't a
normal find query, for example special selects such as `count()` or
`distinct()`, Dito.js detects these cases and cleans up the resulting query by
removing eager statements and clearing `orderBy()` statements again after
application of all scopes.

## Scope Inheritance

If a scope is defined both in a base model class and an inheriting mode class,
both scope functions end up being applied when that scope is requested, in the
sequence from super-class to sub-class. The same logic applies also to longer
inheritance chains.

If a sub-class does not desire the effect of a super-class scope, it can undo
its effects by using Objection.js'
[`clear()`](http://vincit.github.io/objection.js/#clear) method, or in the case
of eager expressions with `clearEager()`.

## Applying Scopes

TODO:

- Through queries (link)
- Through controllers defaults (link)
- Through find controller actions (link)

## Differences to Objection.js

- Objection.js doesn't inherit and merge scope definitions.
- In Objection.js, `scopes` are basically called `modifiers` (previously called
  named filters). But Dito.js' scopes do a few things more than Objection.js'
  modifiers:
  - Dito.js scopes can be eager-applied.
  - Defined `default scopes are automatically eager-applied to find queries.
  - Dito.js scopes can be query objects rather than filter methods that are
    converted to methods through Dito.js' `QueryBuilder.find(query)`.
