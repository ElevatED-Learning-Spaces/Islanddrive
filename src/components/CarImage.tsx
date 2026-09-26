/* eslint-disable @next/next/no-img-element -- Supabase public URLs; no optimiser config needed for the MVP */
export function CarImage({ src, alt, className = '' }: { src: string | null; alt: string; className?: string }) {
  if (src) return <img src={src} alt={alt} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-sea-100 via-sand to-amber-50 ${className}`}>
      <svg viewBox="0 0 64 32" className="w-1/3 text-sea-600/60" fill="currentColor" aria-hidden>
        <path d="M10 22c0-1 .3-2 1-3l5-7c1-1.3 2.4-2 4-2h18c1.6 0 3 .7 4 1.8l6 7.2h6c2.2 0 4 1.8 4 4v3h-4a6 6 0 0 0-12 0H22a6 6 0 0 0-12 0H6v-3c0-.6.4-1 1-1h3zm12-9-4 6h12v-6h-8zm11 0v6h13l-5-5.2c-.4-.5-1-.8-1.7-.8H33z" />
        <circle cx="16" cy="25" r="4" />
        <circle cx="48" cy="25" r="4" />
      </svg>
      <span className="sr-only">{alt}</span>
    </div>
  );
}
