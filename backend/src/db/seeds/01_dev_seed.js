export async function seed(knex) {
  await knex('email_jobs').del();
  await knex('task_documents').del();
  await knex('tasks').del();

  const [task] = await knex('tasks')
    .insert({
      user_id: '123',
      title: 'Complete assignment',
      description: 'Finish PERN task — dev seed',
      priority: 'HIGH',
      processing_type: 'STANDARD',
      status: 'PENDING',
    })
    .returning('id');

  const taskId = typeof task === 'object' ? task.id : task;

  await knex('task_documents').insert({
    task_id: taskId,
    original_filename: 'sample.jpg',
    mime_type: 'image/jpeg',
    size: 1024,
    status: 'PENDING',
    original_url: '/uploads/originals/sample.jpg',
    thumbnail_url: null,
  });

  await knex('email_jobs').insert({
    task_id: taskId,
    recipient: 'dev@example.com',
    subject: 'Task created: Complete assignment',
    status: 'PENDING',
    attempts: 0,
  });
}
