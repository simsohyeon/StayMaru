import { useNavigate } from 'react-router-dom'

interface Props {
  title?: string
  back?: boolean
  right?: React.ReactNode
}

export default function TopBar({ title, back, right }: Props) {
  const nav = useNavigate()
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-6 md:px-10 md:pt-10">
      <div className="flex items-center gap-3">
        {back && (
          <button
            type="button"
            onClick={() => nav(-1)}
            aria-label="back"
            className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink"
          >
            ← <span className="hidden md:inline">back</span>
          </button>
        )}
        {title && (
          <h1 className="font-display text-display-md text-ink md:text-display-lg">
            {title}
          </h1>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}
