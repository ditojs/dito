export default [
  'create', 'created',
  'save', 'saved',
  'submit', 'submitted',
  'delete', 'deleted',
  'edit', 'edited',
  'clear', 'cleared',
  'close', 'closed',
  'cancel', 'cancelled',
  'drag', 'dragged',
  'login', 'logged in'
].reduce((verbs, verb) => {
  verbs[verb] = verb
  return verbs
}, {})
