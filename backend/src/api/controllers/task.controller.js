import * as taskService from '../services/task.service.js';

export async function createTask(req, res) {
  const task = await taskService.createTask({
    userId: req.user.id,
    ...req.validatedBody,
    files: req.files ?? [],
  });

  res.status(201).json({ success: true, data: task });
}

export async function listTasks(req, res) {
  const tasks = await taskService.listTasks(req.user.id);

  res.status(200).json({ success: true, data: tasks });
}

export async function updateTaskStatus(req, res) {
  const task = await taskService.updateTaskStatus(req.user.id, req.params.id, req.validatedBody.status);

  res.status(200).json({ success: true, data: task });
}
