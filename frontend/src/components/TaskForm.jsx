import { useState } from 'react';
import { createTask, createTaskWithImages } from '../api/tasks.js';
import { ALLOWED_IMAGE_TYPES, MAX_FILES, MAX_FILE_MB, validateFiles } from '../utils/files.js';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

// Plan §9.1: title/desc/priority + processingType + image picker + validation hints.
// Submits JSON when no files, FormData when files attached (same endpoint, §5).
export default function TaskForm({ onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', processingType: 'STANDARD' });
  const [pickedFiles, setPickedFiles] = useState([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setFormError('Title is required.');
      return;
    }
    if (title.length > 255) {
      setFormError('Title must be at most 255 characters.');
      return;
    }
    const filesError = validateFiles(pickedFiles);
    if (filesError) {
      setFormError(filesError);
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const created =
        pickedFiles.length > 0
          ? await createTaskWithImages({ ...form, title, files: pickedFiles })
          : await createTask({ ...form, title });
      setForm({ title: '', description: '', priority: 'MEDIUM', processingType: 'STANDARD' });
      setPickedFiles([]);
      onCreated?.(created);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="grid gap-1 text-sm font-semibold text-slate-800">
        Title
        <input
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          maxLength={255}
          placeholder="Complete assignment"
          className={inputCls}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-slate-800">
        Description
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Finish PERN task"
          rows={3}
          className={`${inputCls} resize-y`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-slate-800">
          Priority
          <select value={form.priority} onChange={(e) => update('priority', e.target.value)} className={inputCls}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-800">
          Processing type
          <input
            value={form.processingType}
            onChange={(e) => update('processingType', e.target.value)}
            placeholder="STANDARD"
            className={inputCls}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-slate-800">
        Images (optional)
        <input
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          multiple
          onChange={(e) => setPickedFiles([...e.target.files])}
          className="block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
        />
        <span className="text-xs font-normal text-slate-500">
          jpeg, png, webp, gif — max {MAX_FILE_MB}MB each, up to {MAX_FILES} files.
        </span>
      </label>
      {pickedFiles.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-slate-600">
          {pickedFiles.map((f) => (
            <li key={`${f.name}-${f.size}`}>
              {f.name} ({Math.max(1, Math.round(f.size / 1024))} KB)
            </li>
          ))}
        </ul>
      ) : null}
      {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="justify-self-start rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? 'Creating…' : 'Create task'}
      </button>
    </form>
  );
}
