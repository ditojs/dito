import { defineComponent, h } from 'vue'

const steps = [
  'Collect the goals of the project with the team.',
  'Plan the phases, and the tasks of each phase.',
  'Assign a lead to every phase.',
  'Agree on the budget and the start date.',
  'Share the plan with everyone involved.'
]

// A page without a form, with content taller than the window:
export default defineComponent({
  setup() {
    return () => [
      h('h2', 'Project Guide'),
      ...Array.from({ length: 8 }, () =>
        steps.map(step => h('p', { style: { margin: '0 0 1em' } }, step))
      ).flat(),
      h('p', 'The end of the guide.')
    ]
  }
})
