import Vue from 'vue'

let Component = Vue.extend({
  props: ['name', 'options'],
  render: function(create) {
    let ctor = Component.types[this.options.type]
    let el = create(ctor, { props: this.$props })
    if (!ctor.options.hideLabel) {
      el = create('label', [
        this.options.label,
        el
      ])
    }
    return el
  },
  methods: {
    log: function(...args) {
      console.log(...args)
    }
  }
})

Component.types = []

Component.register = function(type, options) {
  let ctor = Component.extend(Object.assign({ render: null }, options))
  Component.types[type] = ctor
  return ctor
}

export default Component
