import options from './options'
import properties from './properties'
import relations from './relations'
import schema from './schema'
import scopes from './scopes'
import filters from './filters'
import assets from './assets'
import hooks from './hooks'

export default {
  // Export options first, as other definitions may rely on them, e.g. UserMixin
  options,
  properties,
  relations,
  schema,
  scopes,
  filters,
  assets,
  hooks
}
