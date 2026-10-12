import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-content-center gap-4 bg-slate-50 p-6 text-slate-900">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link className="text-teal-700 underline" to="/">Return home</Link>
    </main>
  );
}
