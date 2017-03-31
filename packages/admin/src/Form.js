import Vue from 'vue'
import '@/components/index'
import Component from './Component'

export default Vue.extend({
  props: ['schema'],
  render: function(create) {
    let children = []
    for (let name in this.schema) {
      children.push(create(Component, {
        props: {
          name: name,
          options: this.schema[name]
        }
      }))
    }
    children.push(create('input', {
      domProps: {
        type: 'submit',
        value: 'Submit'
      }
    }))
    return create('form', {
      on: {
        submit: this.submit
      }
    }, children)
  },
  methods: {
    submit: function(event) {
      console.log('submit')
      event.preventDefault()
    }
  }
})
