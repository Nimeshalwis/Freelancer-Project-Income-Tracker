export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-16 text-slate-900">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-teal-700">Project foundation</p>
        <h1 className="text-3xl font-bold tracking-tight">Freelancer Project &amp; Income Tracker</h1>
        <p className="mt-4 leading-7 text-slate-600">React, routing, and Tailwind CSS are ready. The backend provides an API health check.</p>
        <p className="mt-6 rounded-lg bg-slate-100 p-4 text-sm text-slate-600">Authentication, project management, and income tracking will be added in later steps.</p>
      </section>
    </main>
  );
}
