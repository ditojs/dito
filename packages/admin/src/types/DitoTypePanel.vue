<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { setupSchemaComponents } from '../utils/schema/setup.js'

// @vue/component
export default DitoTypeComponent.register('panel', {
  // Panels share the data of their schema, or provide their own data through
  // `schema.data`, see `DitoPanel`, so they never hold a value of their own.
  defaultNested: false,
  generateLabel: false,
  omitSpacing: true,

  getPanelSchema(api, schema) {
    // For a TypePanel, the component schema is also the panel schema. Its name
    // is added to the panel's data path and component path, see
    // `getPanelEntry()`, as unnested components don't add it to data paths.
    return schema
  },

  async processSchema(api, schema, name, routes, level) {
    // Process the panel's components so their forms get resolved too.
    await setupSchemaComponents(api, schema, routes, level)
  },

  render() {
    // Panel components are displayed in the sidebar, see
    // `DitoContainer.panelEntries`, not in place.
    return null
  }
})
</script>
