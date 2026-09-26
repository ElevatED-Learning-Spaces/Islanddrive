import { SubmitButton } from '@/components/SubmitButton';
import { Info } from '@/components/Info';
import { HOST_FEE_PCT } from '@/lib/pricing';
import type { Area, Car } from '@/lib/types';

const money = (c: number | undefined) => (c === undefined ? '' : (c / 100).toFixed(2).replace(/\.00$/, ''));

export function CarForm({ action, areas, car, submitText }: { action: (f: FormData) => Promise<void>; areas: Area[]; car?: Car; submitText: string }) {
  return (
    <form action={action} className="space-y-6">
      {car ? <input type="hidden" name="car_id" value={car.id} /> : null}
      <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
        <legend className="sr-only">The car</legend>
        <h2 className="h2 sm:col-span-2">The car</h2>
        <Field label="Make" name="make" defaultValue={car?.make} placeholder="Toyota" required />
        <Field label="Model" name="model" defaultValue={car?.model} placeholder="Aqua" required />
        <Field label="Year" name="year" type="number" defaultValue={car?.year} required />
        <Field label="Seats" name="seats" type="number" defaultValue={car?.seats ?? 5} required />
        <Select label="Gearbox" name="transmission" defaultValue={car?.transmission ?? 'automatic'} options={[['automatic', 'Automatic'], ['manual', 'Manual']]} />
        <Select label="Fuel" name="fuel" defaultValue={car?.fuel ?? 'gasoline'} options={[['gasoline', 'Gasoline'], ['diesel', 'Diesel'], ['hybrid', 'Hybrid'], ['electric', 'Electric']]} />
        <div className="sm:col-span-2">
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={4} maxLength={3000} defaultValue={car?.description ?? ''} className="input" placeholder="Condition, features (AC, Bluetooth, reverse camera), rules (no smoking)…" />
        </div>
      </fieldset>

      <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="h2 sm:col-span-2">Pickup</h2>
        <Select label="Area" name="area" defaultValue={car?.area ?? ''} options={[['', 'Choose…'], ...areas.map((a) => [a.slug, a.name] as [string, string])]} />
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
          <input type="checkbox" name="delivery_available" defaultChecked={car?.delivery_available} className="h-4 w-4 accent-sea-600" />
          I can deliver the car
        </label>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="pickup_notes">Pickup details (shown after approval)</label>
          <textarea id="pickup_notes" name="pickup_notes" rows={2} maxLength={500} defaultValue={car?.pickup_notes ?? ''} className="input" />
        </div>
      </fieldset>

      <fieldset className="card grid gap-4 p-5 sm:grid-cols-3">
        <h2 className="h2 flex items-center gap-2 sm:col-span-3">
          Price (TT$)
          <Info>IslandDrive keeps {HOST_FEE_PCT}% of the rental and cleaning fee. Guests also pay a service fee on top. The deposit isn’t collected by us — you take it at pickup and return it after the trip.</Info>
        </h2>
        <Field label="Per day" name="daily_rate" inputMode="decimal" defaultValue={money(car?.daily_rate_cents)} placeholder="350" required />
        <Field label="Cleaning fee" name="cleaning_fee" inputMode="decimal" defaultValue={money(car?.cleaning_fee_cents)} placeholder="0" />
        <Field label="Deposit" name="deposit" inputMode="decimal" defaultValue={money(car?.deposit_cents)} placeholder="0" />
        <Field label="Weekly discount %" name="weekly_discount_pct" type="number" defaultValue={car?.weekly_discount_pct ?? 0} />
        <Field label="Min days" name="min_days" type="number" defaultValue={car?.min_days ?? 1} required />
        <Field label="Max days" name="max_days" type="number" defaultValue={car?.max_days ?? 30} required />
      </fieldset>
      <SubmitButton pendingText="Saving…">{submitText}</SubmitButton>
    </form>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" {...rest} defaultValue={rest.defaultValue ?? undefined} />
    </div>
  );
}

function Select({ label, name, options, defaultValue }: { label: string; name: string; options: [string, string][]; defaultValue: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={defaultValue} className="input" required>
        {options.map(([v, l]) => <option key={v} value={v} disabled={v === ''}>{l}</option>)}
      </select>
    </div>
  );
}
