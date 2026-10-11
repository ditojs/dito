# Upgrading to Dito.js 4.0

## Admin

### Routes

The routes of the admin are generated from a route tree, built once from the
schemas of the views, instead of by the types while they set up their schemas.

- The URLs of the forms of lists in nested sections and inlined objects contain
  the name of their container, like the data path of their items, e.g.
  `/books/1/contents/notes/2` for a list `notes` in a section `contents` with
  `nested: true`. Sections without `nested: true` hold no data of their own and
  stay out of the URLs.
- The forms of lists in forms that are shared by several views or lists are
  routed in each of them.
- `maxDepth` limits how often a list with routed forms occurs inside itself in
  a route, also when its form is shared, and lists beyond it don't render, as
  intended. In inlined content, it limits how deep forms with routes are
  reached through lists that share the same forms.
- Lists with their own `path`, and lists whose names don't survive normalizing
  their paths (e.g. `sourceURLs`), open their items' forms.
- Lists linked to views (`view:`) link to the form of the view also when the
  view has several components, and can create items there.
- The items of tree lists with a resource are addressed by their id in URLs,
  like the items of other lists with a resource.
- Saving the forms of the children of tree items doesn't reload the tree,
  which only matters for trees whose children have their own resource.

### Data

Views, forms, dialogs and panels with their own data each have a data model,
which components write the data through, as `component.dataModel`.

- Forms are dirty once their data is edited, until it's saved, applied or
  loaded again, instead of when it differs from the data they started with.
  Reverting an edit leaves the form dirty, while writes that don't change the
  value aren't edits.
- Dirty state belongs to the one that saves the data: the form or view, and
  each source with its own resource for the changes of its list and inside
  it, e.g. the order of its items or the children of tree items. Forms and
  such sources only count as dirty if they have a button of type `submit`,
  whatever its name, views by any edit. `dataModel.isDirty` tells this,
  `dataModel.isEdited` whether the data was edited at all.
- Direct writes to the data don't make it dirty, e.g. of what an action on the
  server saved. `formComponent.applyCleanChanges()` is removed: write the data
  directly instead. Code that edits data directly calls
  `dataModel.markDirty()`, and `dataModel.markClean()` once it saved it.
- Custom types that change their value in place write it through the data
  model: `set(data, key, value)`, `insert(list, index, item)`,
  `remove(list, index)`, `move(list, from, to)` and
  `replaceChildren(list, items)`. Assigning `value` does this already.
  `emitChangeEvent()` is removed: call `onChange()`.
- Forms with `mutate: true` edit the item of their parent through the data
  model of the parent, which turns dirty right away. Cancel only closes them.
  When they create their item or load it through their own resource, they
  have their own data model.
- Applying a nested form makes the parent dirty if it changes the item.
- Changes of the lists of sources with their own resource are clean again
  once a button of the source submitted them through a resource, while other
  edits stay dirty.
- Components in panels with their own data, e.g. filters, get their defaults
  and computed values, and their edits don't make the view or form dirty.
- Submitting waits for running uploads, without a time limit, so that the
  stored files are sent, also through the buttons of sources with their own
  resource, which also wait for the loads of data schemas and options now.
- Type components, schemas and panels no longer have `isDirty`, type
  components no longer `markDirty()`.

### Validation

- Errors live in the data model, by the data that holds each value and its
  name, so they stay with items that move, and with fields that aren't
  mounted, e.g. in collapsed sections. Read and write them with
  `dataModel.getErrors(dataPath)`, `setErrors(dataPath, errors)`,
  `addError(dataPath, message)`, `removeError(dataPath, message)`,
  `replaceErrors(errors, { dataPath, server })` and `clearErrors(dataPath)`.
- The errors of values, of validation and of the server, apply to the value
  that they were set for: they're hidden once the value changes, also in
  place or through direct writes, until it changes back. Validating a value
  again, e.g. on blur, only replaces its validation errors.
- The errors of fields, e.g. of options that failed to load or of searches,
  are added with `addError()` and stay until their source removes them with
  `removeError()`.
- Nested forms take over the errors of their item when they open, and when
  their parent reveals errors while they're open.
- The rows of lists and the items of trees whose items or children hold
  values with errors are marked with `dito-table__row--error` and
  `dito-tree-item--error`, e.g. for errors in the forms of nested routes.
- The validation errors of the server for the buttons of lists with their own
  resource are notified, as their items are edited in their own forms.
- Type components no longer have `errors`, `hasErrors`, `isTouched`,
  `isValid`, `isValidated`, `verify()`, `markTouched()`, `clearValidation()`,
  `resetValidation()`, `addError()`, `getErrors()`, `clearErrors()` and
  `showValidationErrors()`. `validate()` remains, and replaces the errors of
  the field.
- Forms, views and schemas no longer have `errors`, `hasErrors`, `isTouched`,
  `isValid`, `isValidated` and `clearErrors()`, schemas no longer
  `resetValidation()`. `resetValidation()` of forms and views clears the
  errors of the values of their data, also of mutating forms, which share the
  data model of their parent. `showValidationErrors(errors)` of forms and
  views takes only the errors.
- Panels no longer have `errors`, `isTouched`, `isValid`, `isValidated`,
  `validateAll()`, `verifyAll()`, `resetValidation()` and `clearErrors()`.
  Their `mainSchemaComponent` validates and shows errors instead.
- `navigateToComponent()` and `navigateToRouteComponent()` are replaced by
  `revealComponents(dataPath)`, which opens collapsed schemas and inlined
  items, and returns the components that display the value. Errors in the
  forms of nested routes open them through the route tree.

### Custom types

- `processSchema(api, schema, name)` only sets up the schema, e.g. resolves the
  schemas that it contains. It no longer receives `routes` and `level`, and
  doesn't add routes.
- Types whose forms render inside the form or view of their parent route set
  `hasNestedForms: true`.
- Types that route sources next to the forms of their items, like the children
  of tree items, return their schemas from `getChildSourceSchemas(schema)`.
