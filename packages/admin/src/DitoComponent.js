import Vue from 'vue'
import _ from 'lodash'

let DitoComponent = Vue.extend({
  name: 'DitoComponent',

  methods: {
    log (...args) {
      console.log(...args)
    }
  }
})

DitoComponent.types = []

DitoComponent.register = function(type, options) {
  let ctor = DitoComponent.extend(Object.assign({
    name: 'Dito' + _.capitalize(type) + 'Component',
    props: ['name', 'desc']
  }, options))
  DitoComponent.types[type] = ctor
  return ctor
}

export default DitoComponent
