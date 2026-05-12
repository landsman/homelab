import { Tooltip } from './tooltip'

interface FooterProps {
  onSettingsClick: () => void
}

export function Footer({ onSettingsClick }: FooterProps) {
  return (
    <footer className="px-6 md:px-8 pb-8 flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
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
      </div>

      <span className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase opacity-30">
        raspberry pi homelab
      </span>
    </footer>
  )
}
