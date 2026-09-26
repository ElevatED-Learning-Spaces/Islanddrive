import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page max-w-md text-center">
      <h1 className="h1">Page not found</h1>
      <p className="muted mt-2">That car or page doesn’t exist, or you don’t have access to it.</p>
      <Link href="/cars" className="btn-primary mt-6">Browse cars</Link>
    </div>
  );
}
