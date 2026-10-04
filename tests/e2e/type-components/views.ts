import { caseEntries } from './cases/index.js'

// One view per case, editing the case's column of the single `Case` row.
export default Object.fromEntries(
  caseEntries.map(({ name, path, label, schema }) => [
    name,
    {
      type: 'view',
      label,
      path,
      component: {
        type: 'object',
        resource: 'cases/1',
        form: {
          type: 'form',
          components: { [name]: schema }
        }
      }
    }
  ])
)
