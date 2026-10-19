<script>
import { defineType } from '../utils/schema/types.ts'
import { nestableTraits } from './traits.ts'
import { fieldProps, useField } from '../composables/useField.ts'
import { setupSchemaComponents } from '../utils/schema/setup.js'

// @vue/component
const DitoPanelType = {
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
  component: DitoPanelType,
  // Panels share the data of their schema, nest theirs in it like sections, or
  // have their own `schema.data`:
  ...nestableTraits,
  generatesLabel: false,
  omitsSpacing: true,

  getPanelSchema(api, schema) {
    // The component schema is the panel schema. `getAllPanelEntries()` adds
    // its name to the paths of the item that holds it:
    return schema
  },

  async setupSchema({ schema, api }) {
    await setupSchemaComponents(api, schema)
  }
})

export default DitoPanelType
</script>
