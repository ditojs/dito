// DitoTypeComponent is the abstract base component for all other type
// components inside the types/ folder. There's also a separate concrete
// `DitoTypeComponent.vue` component, use to render `{ type: 'component' }`
import DitoComponent from './DitoComponent.js'
import TypeMixin from './mixins/TypeMixin.js'

// @vue/component
export default {
  extends: DitoComponent,
  mixins: [TypeMixin],

  component: DitoComponent.component
}
