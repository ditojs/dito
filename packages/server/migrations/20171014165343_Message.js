export function up(knex) {
  return knex.schema
    .createTable('message', table => {
      table.increments('id').primary()
      table.string('text')
      table.integer('dummy_id').unsigned()
        .references('id').inTable('dummy')
    })
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('message')
}
