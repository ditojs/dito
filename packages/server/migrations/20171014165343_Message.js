export function up(knex) {
  return knex.schema
    .createTable('message', table => {
      table.increments('id').primary()
      table.integer('dummy_id').unsigned()
        .references('id').inTable('dummy')
      table.string('text')
      table.timestamp('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'))
    })
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('message')
}
