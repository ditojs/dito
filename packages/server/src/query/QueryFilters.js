import Registry from './Registry'

export const QueryFilters = new Registry()

function filter(builder, where = 'where', method = '', ref, operator, value) {
  const columnName = ref.getFullColumnName(builder)
  return {
    method: `${where}${method}`,
    args: operator
      ? [columnName, operator, value]
      : value !== undefined
        ? [columnName, value]
        : [columnName]
  }
}

QueryFilters.register({
  is(builder, where, ref, value) {
    return filter(builder, where, '', ref, null, value)
  },

  not(builder, where, ref, value) {
    return filter(builder, where, 'Not', ref, null, value)
  },

  in(builder, where, ref, value) {
    return filter(builder, where, 'In', ref, null, value.split(','))
  },

  notIn(builder, where, ref, value) {
    return filter(builder, where, 'NotIn', ref, null, value.split(','))
  },

  between(builder, where, ref, value) {
    return filter(builder, where, 'Between', ref, null, value.split(','))
  },

  notBetween(builder, where, ref, value) {
    return filter(builder, where, 'NotBetween', ref, null, value.split(','))
  },

  null(builder, where, ref) {
    return filter(builder, where, 'Null', ref, null, undefined)
  },

  notNull(builder, where, ref) {
    return filter(builder, where, 'NotNull', ref, null, undefined)
  },

  empty(builder, where, ref) {
    return filter(builder, where, '', ref, '=', '')
  },

  notEmpty(builder, where, ref) {
    // https://stackoverflow.com/a/42723975/1163708
    return filter(builder, where, '', ref, '>', '')
  }
})

// TODO: ?
// http://docs.sequelizejs.com/manual/tutorial/querying.html
// [Op.regexp]: '^[h|a|t]'    // REGEXP/~ '^[h|a|t]' (MySQL/PG only)
// [Op.notRegexp]: '^[h|a|t]' // NOT REGEXP/!~ '^[h|a|t]' (MySQL/PG only)
// [Op.iRegexp]: '^[h|a|t]'    // ~* '^[h|a|t]' (PG only)
// [Op.notIRegexp]: '^[h|a|t]' // !~* '^[h|a|t]' (PG only)
// [Op.like]: { [Op.any]: ['cat', 'hat']}
// LIKE ANY ARRAY['cat', 'hat'] - also works for iLike and notLike
// [Op.overlap]: [1, 2]       // && [1, 2] (PG array overlap operator)
// [Op.contains]: [1, 2]      // @> [1, 2] (PG array contains operator)
// [Op.contained]: [1, 2]     // <@ [1, 2] (PG array contained by operator)
// [Op.any]: [2,3]            // ANY ARRAY[2, 3]::INTEGER (PG only)

const operators = {
  eq: '=',
  ne: '!=',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  between: 'between',
  notBetween: 'not between',
  like: 'like',
  notLike: 'not like',
  iLike: 'ilike',
  notILike: 'not ilike'
}

for (const [key, operator] of Object.entries(operators)) {
  QueryFilters.register(key, (builder, where, ref, value) =>
    filter(builder, where, '', ref, operator, value)
  )
}
