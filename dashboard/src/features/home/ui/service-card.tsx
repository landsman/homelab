import { HotKey } from '../../common/hotkey/hot-key.tsx'
import { formatHotkeyLabel } from '../../common/hotkey/hotkey.ts'
import { startNavigation, useNavProgress } from '../../common/nav-progress/nav-progress.ts'
import { HomeService } from '../data/services.types.ts'
import { ServiceIcon } from './service-icon.tsx'

interface ServiceCardProps {
  service: HomeService
}

export function ServiceCard({ service }: ServiceCardProps) {
  const nav = useNavProgress()
  const isFiring = nav.active && nav.serviceName === service.name

  return (
    <a
      href={service.url}
      target="_self"
      rel="noopener noreferrer"
      onClick={e => {
        // Skip on modifier-click / non-primary-click — those open in new tab / spawn no page unload.
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        startNavigation(service.name)
      }}
      className="relative group flex flex-col items-center gap-3 p-4 rounded-xl border border-(--border) bg-(--card) hover:border-(--dim) hover:bg-[#111d2e] transition-all duration-150"
      aria-label={`Open ${service.name}`}
    >
      <ServiceIcon service={service} />

      {service.shortcut && (
        <HotKey
          forceActive={isFiring}
          className="hidden md:inline-flex absolute top-2 right-2 text-[11px] uppercase"
        >
          {formatHotkeyLabel(service.shortcut)}
        </HotKey>
      )}

      <span
        title={service.name}
        className="text-xs font-semibold text-slate-300 group-hover:text-white group-hover:-translate-y-0.5 transition-all duration-300 truncate w-full text-center"
      >
        {service.name}
      </span>
    </a>
  )
}
