export default [
  'create', 'created',
  'save', 'saved',
  'delete', 'deleted',
  'edit', 'edited',
  'cancel', 'cancelled',
  'drag', 'dragged'
].reduce((verbs, verb) => {
  verbs[verb] = verb
  return verbs
}, {})
