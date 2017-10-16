export function up(knex) {
  return knex.schema
    .createTable('Dummy', table => {
      table.increments('id').primary()
      table.string('firstName')
      table.string('lastName')
      table.string('prefix')
      table.string('country')
      table.date('dateOfBirth')
      table.string('email')
      table.integer('age')
      table.double('factor')
      table.json('dogs')
      table.json('colors')
      table.boolean('verified')
      table.string('comments')
    })
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('Dummy')
}
