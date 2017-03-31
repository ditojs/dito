import Vue from 'vue'
import _ from 'lodash'

let DitoComponent = Vue.extend({
  props: ['name', 'options'],
  name: 'DitoComponent',

  render (create) {
    let ctor = DitoComponent.types[this.options.type]
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

DitoComponent.types = []

DitoComponent.register = function(type, options) {
  let opts = Object.assign({
    name: 'Dito' + _.capitalize(type) + 'Component',
    render: null
  }, options)
  let ctor = DitoComponent.extend(opts)
  DitoComponent.types[type] = ctor
  return ctor
}

export default DitoComponent
