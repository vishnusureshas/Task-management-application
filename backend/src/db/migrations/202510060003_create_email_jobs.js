export function up(knex) {
  return knex.schema.createTable('email_jobs', (table) => {
    table.increments('id').primary();
    table
      .integer('task_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('tasks')
      .onDelete('CASCADE')
      .index();
    table.string('recipient', 255).notNullable().index();
    table.string('subject', 255).notNullable();
    // Allowed: PENDING | PROCESSING | COMPLETED | FAILED
    table.string('status', 20).notNullable().defaultTo('PENDING').index();
    table.integer('attempts').notNullable().defaultTo(0);
    table.text('error_message').nullable();
    table.timestamp('sent_at').nullable();
    table.timestamps(true, true);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('email_jobs');
}
