import { Link, NavLink, Route, Routes } from 'react-router-dom';
import TasksPage from './pages/TasksPage.jsx';
import TaskDetailPage from './pages/TaskDetailPage.jsx';
import QueuesPage from './pages/QueuesPage.jsx';

function navCls({ isActive }) {
  return `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 antialiased">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold tracking-tight">
              Task Manager
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navCls}>
                Tasks
              </NavLink>
              <NavLink to="/queues" className={navCls}>
                Queues
              </NavLink>
            </nav>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<TasksPage />} />
            <Route path="/tasks/:id" element={<TaskDetailPage />} />
            <Route path="/queues" element={<QueuesPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
