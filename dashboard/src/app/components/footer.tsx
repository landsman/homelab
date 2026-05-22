import { Tooltip } from './tooltip'

interface FooterProps {
  onSettingsClick: () => void
}

export function Footer({ onSettingsClick }: FooterProps) {
  return (
    <footer className="px-6 md:px-8 pb-8 flex flex-col items-center gap-4">
      <div className="flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity">
        <Tooltip content="Settings — change timezone, locale and other preferences" placement="top">
          <button
            onClick={onSettingsClick}
            className="flex flex-col items-center group"
            aria-label="Open settings"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="text-[var(--text-muted)] group-hover:text-slate-300 transition-colors shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 0 1-2.287-.947zM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </Tooltip>
        <Tooltip
          content="Hold Shift to reveal keyboard shortcuts, then press Shift + the highlighted letter or digit to open that service."
          placement="top"
        >
          <span
            className="flex flex-col items-center group cursor-help"
            tabIndex={0}
            role="button"
            aria-label="Keyboard shortcut help"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="text-[var(--text-muted)] group-hover:text-slate-300 transition-colors shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm.75-3.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zM7.5 8a2.5 2.5 0 1 1 3.7 2.196c-.45.25-.95.65-.95 1.304v.5a.75.75 0 0 1-1.5 0V11.5c0-1.16.81-1.87 1.314-2.15A1 1 0 1 0 9 8.5a.75.75 0 0 1-1.5 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </Tooltip>
      </div>

      <span className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase opacity-30">
        raspberry pi homelab
      </span>
    </footer>
  )
}
