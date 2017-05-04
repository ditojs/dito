import Vue from 'vue'
import { Validator } from 'vee-validate'

// In order to share one $validator across multiple components, the parent needs
// to use the ValidatorMixin. For more information, see:
// https://github.com/logaretm/vee-validate/issues/468#issuecomment-299171029

export default {
  computed: {
    $validator() {
      const validator = new Validator(null, { init: false })
      Vue.util.defineReactive(validator, 'errorBag', validator.errorBag)
      Vue.util.defineReactive(validator, 'fieldBag', validator.fieldBag)
      return validator
    }
  }
}
