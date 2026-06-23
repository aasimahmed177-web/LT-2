import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ErrorBoundary from './ErrorBoundary';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <main className="ml-56 flex-1 min-h-screen flex flex-col">
        <div className="flex-1 px-10 py-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}