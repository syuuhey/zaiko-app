'use client'

export const panelClass = 'rounded-xl border border-neutral-200 bg-white p-4'
export const buttonClass = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-neutral-900 px-3 text-sm font-bold text-white disabled:opacity-50'

export function QuantityInput({ label, value, onChange, disabled }: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const number = readQuantity(value) ?? 0
  return (
    <div className="flex shrink-0 items-center rounded-lg border border-neutral-300">
      <button type="button" className="h-11 w-11 text-xl disabled:opacity-40" aria-label={`${label}を減らす`}
        disabled={disabled || number === 0} onClick={() => onChange(String(number - 1))}>−</button>
      <input aria-label={label} type="text" inputMode="numeric" value={value} disabled={disabled}
        className="h-11 w-14 border-x border-neutral-200 text-center text-base font-semibold tabular-nums"
        onFocus={(event) => event.currentTarget.select()} onChange={(event) => onChange(event.target.value)} />
      <button type="button" className="h-11 w-11 text-xl disabled:opacity-40" aria-label={`${label}を増やす`}
        disabled={disabled || number >= 2_147_483_647} onClick={() => onChange(String(number + 1))}>＋</button>
    </div>
  )
}

export function readQuantity(value: string) {
  const number = Number(value)
  return /^[0-9]+$/.test(value) && number <= 2_147_483_647 ? number : null
}
