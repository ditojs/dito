import Vue from 'vue'
import './components'
import DitoComponent from './DitoComponent'

export default Vue.extend({
  props: ['schema'],
  name: 'DitoForm',

  render (create) {
    let children = []
    for (let name in this.schema) {
      children.push(create(DitoComponent, {
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
    submit (event) {
      console.log('submit')
      event.preventDefault()
    }
  }
})
