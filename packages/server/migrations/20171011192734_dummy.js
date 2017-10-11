exports.up = knex => knex.schema
  .createTable('Dummy', table => {
    table.increments('id').primary()
    table.string('firstName')
    table.string('lastName')
    table.string('prefix')
    table.string('country')
    table.datetime('dateOfBirth')
    table.string('email')
    table.integer('age')
    table.float('factor')
    table.json('dogs')
    table.json('colors')
    table.boolean('verified')
    table.string('comments')
  })

exports.down = knex => knex.schema
  .dropTableIfExists('Dummy')
