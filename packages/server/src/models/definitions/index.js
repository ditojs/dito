import options from './options.js'
import properties from './properties.js'
import relations from './relations.js'
import schema from './schema.js'
import scopes from './scopes.js'
import filters from './filters.js'
import modifiers from './modifiers.js'
import assets from './assets.js'
import hooks from './hooks.js'

export default {
  // Export options first, as other definitions may rely on them, e.g. UserMixin
  options,
  properties,
  relations,
  schema,
  scopes,
  filters,
  modifiers,
  assets,
  hooks
}
