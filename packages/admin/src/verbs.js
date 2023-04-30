export default [
  'create', 'created',
  'save', 'saved',
  'apply', 'applied',
  'submit', 'submitted',
  'delete', 'deleted',
  'remove', 'removed',
  'clear', 'cleared',
  'edit', 'edited',
  'close', 'closed',
  'cancel', 'cancelled',
  'drag', 'dragged',
  'login', 'logged in'
].reduce((verbs, verb) => {
  verbs[verb] = verb
  return verbs
}, {})
