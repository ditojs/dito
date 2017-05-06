import Vue from 'vue'
import VeeValidate from 'vee-validate'
Vue.use(VeeValidate)
// Remove the VeeValidate beforeCreate() and mounted() hooks again that create
// and assume $validator objects for every component:
// TODO: Get this fixed properly, see:
// https://github.com/logaretm/vee-validate/issues/468
Vue.options.beforeCreate.pop()
Vue.options.mounted.pop()

// In order to share one $validator across multiple components, the parent needs
// to use the ValidatorMixin. For more information, see:
// https://github.com/logaretm/vee-validate/issues/468#issuecomment-299171029
export default {
  provide() {
    const validator = this.$validator = new VeeValidate.Validator(null,
        { init: false })
    Vue.util.defineReactive(validator, 'errorBag', validator.errorBag)
    Vue.util.defineReactive(validator, 'fieldBag', validator.fieldBag)
    return {
      $validator: validator
    }
  }
}
