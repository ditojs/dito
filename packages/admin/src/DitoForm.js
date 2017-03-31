import Vue from 'vue'
import './components'
import DitoComponent from './DitoComponent'
import DitoLabelComponent from './components/DitoLabelComponent'
import DitoButtonComponent from './components/DitoButtonComponent'

export default DitoComponent.extend({
  props: ['schema'],
  name: 'DitoForm',

  render (create) {
    let children = []
    for (let name in this.schema) {
      children.push(this.createField(create, name, this.schema[name]))
    }
    children.push(this.createButton(create, {
      type: 'submit',
      text: 'Submit'
    }))
    return create('form', {
      on: {
        submit: this.submit
      }
    }, children)
  },

  methods: {
    createField (create, name, desc) {
      let ctor = DitoComponent.types[desc.type]
      let options = {
        props: {
          name: name,
          desc: desc
        }
      }
      let el = create(ctor, options)
      return desc.label && !ctor.options.hideLabel
          ? create(DitoLabelComponent, options, [el])
          : el
    },

    createButton (create, desc) {
      return create(DitoButtonComponent, {
        props: {
          desc: desc
        }
      })
    },

    submit (event) {
      this.log('submit')
      event.preventDefault()
    }
  }
})
