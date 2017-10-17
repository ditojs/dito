export function up(knex) {
  return knex.schema
    .createTable('dummy', table => {
      table.increments('id').primary()
      table.string('first_name')
      table.string('last_name')
      table.string('prefix')
      table.string('country')
      table.date('date_of_birth')
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
    .dropTableIfExists('dummy')
}
