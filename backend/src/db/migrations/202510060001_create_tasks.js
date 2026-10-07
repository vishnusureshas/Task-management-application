export function up(knex) {
  return knex.schema.createTable('tasks', (table) => {
    table.increments('id').primary();
    table.string('user_id', 255).notNullable().index();
    table.string('title', 255).notNullable();
    table.text('description').nullable();
    // Allowed: LOW | MEDIUM | HIGH (enforced at validator layer, Section 4)
    table.string('priority', 20).notNullable().defaultTo('MEDIUM').index();
    table.string('processing_type', 50).notNullable().defaultTo('STANDARD');
    // Allowed: PENDING | PROCESSING | COMPLETED | FAILED
    table.string('status', 20).notNullable().defaultTo('PENDING').index();
    table.timestamps(true, true);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('tasks');
}
