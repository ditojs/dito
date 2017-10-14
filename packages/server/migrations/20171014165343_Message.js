export function up(knex) {
  return knex.schema
    .createTable('Message', table => {
      table.increments('id').primary()
      table.string('text')
      table.integer('dummyId').unsigned()
        .references('id').inTable('Dummy')
    })
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('Message')
}
