'use client'

import { useActionState, type ReactNode } from 'react'
import ConfirmButton from '@/app/dashboard/components/ConfirmButton'

const fieldClass = 'mt-1 block w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900'
const buttonClass = 'rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50'

type OrderAction = (previous: string | null, formData: FormData) => Promise<string | null>

export function OrderForm({ action, label, confirmation, children }: {
  action: OrderAction
  label: string
  confirmation?: string
  children?: ReactNode
}) {
  const [error, submit, pending] = useActionState(action, null)

  return (
    <form action={submit} className="space-y-2">
      <fieldset disabled={pending} className="flex flex-wrap items-end gap-2">
        {children}
        {confirmation ? (
          <ConfirmButton message={confirmation} className={buttonClass + ' border border-neutral-200 text-neutral-700'}>
            {label}
          </ConfirmButton>
        ) : (
          <button className={buttonClass + ' bg-neutral-900 text-white'}>{label}</button>
        )}
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  )
}

export function QuantityField({ label, initialQuantity }: { label: string; initialQuantity?: number }) {
  return (
    <label className="w-24 text-xs text-neutral-600">
      {label}
      <input
        name="quantity"
        type="text"
        inputMode="numeric"
        pattern="[0-9]+"
        required
        defaultValue={initialQuantity}
        onFocus={(event) => event.currentTarget.select()}
        className={fieldClass}
      />
    </label>
  )
}
