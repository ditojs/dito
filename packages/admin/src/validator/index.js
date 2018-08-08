import Vue from 'vue'
import VeeValidate, { Validator } from 'vee-validate'
import * as rules from './rules'

Vue.use(VeeValidate, {
  // See: https://github.com/logaretm/vee-validate/issues/468
  inject: false,
  // Prefix `errors` and `fields with $ to make it clear they're special props:
  errorBagName: '$errors',
  fieldsBagName: '$fields'
})

// Register all custom validator rules
for (const [key, value] of Object.entries(rules)) {
  Validator.extend(key, value)
}
