export default [
  'create', 'created',
  'save', 'saved',
  'submit', 'submitted',
  'delete', 'deleted',
  'edit', 'edited',
  'close', 'closed',
  'cancel', 'cancelled',
  'drag', 'dragged'
].reduce((verbs, verb) => {
  verbs[verb] = verb
  return verbs
}, {})
