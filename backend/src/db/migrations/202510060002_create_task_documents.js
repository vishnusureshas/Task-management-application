export function up(knex) {
  return knex.schema.createTable('task_documents', (table) => {
    table.increments('id').primary();
    table
      .integer('task_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tasks')
      .onDelete('CASCADE')
      .index();
    table.string('original_filename', 255).notNullable();
    table.string('mime_type', 100).nullable();
    table.integer('size').nullable();
    // Allowed: PENDING | PROCESSING | COMPLETED | FAILED
    table.string('status', 20).notNullable().defaultTo('PENDING').index();
    table.text('original_url').nullable();
    table.text('thumbnail_url').nullable();
    table.timestamps(true, true);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('task_documents');
}
