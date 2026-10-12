<script>
import DitoTypeComponent from '../DitoTypeComponent.js'
import { defineType } from '../utils/schema/types.ts'
import { setupSchemaComponents } from '../utils/schema/setup.js'

// @vue/component
const DitoTypePanel = DitoTypeComponent.component('DitoTypePanel', {
  render() {
    // Panel components are displayed in the sidebar, see
    // `DitoContainer.panelEntries`, not in place.
    return null
  }
})

defineType({
  types: ['panel'],
  component: DitoTypePanel,
  // Panels share the data of their schema, or provide their own data through
  // `schema.data`, see `DitoPanel`, so they never hold a value of their own.
  defaultNested: false,
  generateLabel: false,
  omitSpacing: true,

  getPanelSchema(api, schema) {
    // For a TypePanel, the component schema is also the panel schema. Its name
    // is added to the panel's data path and component path, see
    // `getAllPanelEntries()`, as unnested components don't add it to data
    // paths.
    return schema
  },

  async processSchema(api, schema) {
    // Process the panel's components so their forms get resolved too.
    await setupSchemaComponents(api, schema)
  }
})

export default DitoTypePanel
</script>
