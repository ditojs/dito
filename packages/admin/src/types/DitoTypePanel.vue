<script>
import DitoTypeComponent from '../DitoTypeComponent.js'

// @vue/component
export default DitoTypeComponent.register('panel', {
  defaultValue: () => undefined, // Callback to override `defaultValue: null`
  excludeValue: true,
  generateLabel: false,
  omitSpacing: true,

  getPanelSchema(api, schema) {
    // For a TypePanel, the component schema is also the panel schema, but
    // remove the added name, so it doesn't get appended twice to data-path.
    const { name, ...panel } = schema
    return panel
  }
})
</script>
