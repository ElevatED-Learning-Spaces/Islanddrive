import type { Area } from '@/lib/types';

// Plain GET form → /cars?area=&start=&end=. Works without JavaScript.
export function SearchForm({
  areas,
  values = {},
  compact = false,
  minDate,
}: {
  areas: Area[];
  values?: { area?: string; start?: string; end?: string };
  compact?: boolean;
  minDate: string;
}) {
  const islands: { key: Area['island']; label: string }[] = [
    { key: 'trinidad', label: 'Trinidad' },
    { key: 'tobago', label: 'Tobago' },
  ];
  return (
    <form action="/cars" method="get" className={`grid gap-3 ${compact ? 'sm:grid-cols-[1.4fr_1fr_1fr_auto]' : 'sm:grid-cols-[1.6fr_1fr_1fr_auto]'} items-end`}>
      <div>
        <label className="label" htmlFor="area">Where</label>
        <select id="area" name="area" defaultValue={values.area ?? ''} className="input">
          <option value="">Anywhere in T&amp;T</option>
          {islands.map((i) => (
            <optgroup key={i.key} label={i.label}>
              {areas.filter((a) => a.island === i.key).map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="start">Pickup</label>
        <input id="start" name="start" type="date" min={minDate} defaultValue={values.start} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="end">Return</label>
        <input id="end" name="end" type="date" min={minDate} defaultValue={values.end} className="input" />
      </div>
      <button className="btn-primary h-[42px]" type="submit">Search cars</button>
    </form>
  );
}
