<script>
import { defineType } from '../utils/schema/types.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { setupSchemaComponents } from '../utils/schema/setup.js'

// @vue/component
const DitoTypePanel = {
  name: 'DitoTypePanel',
  props: fieldProps,

  setup(props) {
    useField(props)
  },

  render() {
    // Panels are displayed in the sidebar, see `DitoContainer.panelEntries`:
    return null
  }
}

defineType({
  type: 'panel',
  component: DitoTypePanel,
  // Panels share the data of their schema, or have their own `schema.data`:
  defaultNested: false,
  generateLabel: false,
  omitSpacing: true,

  getPanelSchema(api, schema) {
    // The component schema is the panel schema. `getAllPanelEntries()` adds
    // its name to the paths, as unnested components don't:
    return schema
  },

  async setupSchema(api, schema) {
    await setupSchemaComponents(api, schema)
  }
})

export default DitoTypePanel
</script>
