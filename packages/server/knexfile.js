module.exports = {
  development: {
    client: 'sqlite3',
    useNullAsDefault: true,
    connection: {
      filename: './lineto.db'
    }
  },

  production: {
    client: 'postgresql',
    connection: {
      database: 'lineto-koa'
    },
    pool: {
      min: 2,
      max: 10
    }
  }
}
