'use client'

export default function ConfirmButton({
  message,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  message: string
  formAction?: (formData: FormData) => void
}) {
  return (
    <button
      {...props}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault()
      }}
    >
      {children}
    </button>
  )
}
