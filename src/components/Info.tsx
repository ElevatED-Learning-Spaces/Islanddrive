// ⓘ hint: a small native popover for explanations that would clutter the layout.
export function Info({ children, label = 'More info' }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="relative inline-block align-middle">
      <summary aria-label={label} className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-line text-[11px] font-bold text-ink-soft hover:border-sea-500 [&::-webkit-details-marker]:hidden">
        i
      </summary>
      <div className="absolute left-1/2 z-20 mt-2 w-64 -translate-x-1/2 rounded-xl border border-line bg-white p-3 text-xs leading-relaxed text-ink-soft shadow-lg">
        {children}
      </div>
    </details>
  );
}
