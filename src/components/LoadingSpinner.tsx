interface Props {
  message: string
  className?: string
}

export function LoadingSpinner({ message, className }: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 p-8 text-center ${className ?? ''}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className="h-6 w-6 animate-spin text-[var(--color-accent)]"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-sm text-[var(--color-fg-dim)]">{message}</p>
    </div>
  )
}
