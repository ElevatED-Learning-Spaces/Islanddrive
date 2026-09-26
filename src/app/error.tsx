'use client';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="page max-w-md text-center">
      <h1 className="h1">Something went wrong</h1>
      <p className="muted mt-2">Please try again. If it keeps happening, let us know on WhatsApp.</p>
      <button onClick={reset} className="btn-primary mt-6">Try again</button>
    </div>
  );
}
