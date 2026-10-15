import PostgresClient from 'knex/lib/dialects/postgres/index.js'

// Support PostgreSQL type parser mappings in the config:
export class PostgreSQLClient extends PostgresClient {
  initializeDriver() {
    super.initializeDriver()
    const { typeParsers } = this.config
    if (typeParsers) {
      const { types } = this.driver
      for (const [type, parser] of Object.entries(typeParsers)) {
        types.setTypeParser(type, parser)
      }
      // Automatically setup array type parsers for numeric and int8.
      const setupArrayParser = (valueType, arrayType) => {
        if (valueType in typeParsers && !(arrayType in typeParsers)) {
          const parseValue = types.getTypeParser(valueType)
          const parseArray = types.getTypeParser(arrayType)
          types.setTypeParser(arrayType, text =>
            parseArray(text).map(value =>
              value === null ? value : parseValue(value)
            )
          )
        }
      }

      setupArrayParser(1700, 1231) // numeric
      setupArrayParser(20, 1016) // int8
      // setupArrayParser(21, 1005) // int2
      // setupArrayParser(23, 1007) // int4
      // setupArrayParser(700, 1021) // float4
      // setupArrayParser(701, 1022) // float8
    }
  }
}
