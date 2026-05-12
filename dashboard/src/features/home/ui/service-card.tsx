import { HotKey } from '../../common/hotkey/hot-key.tsx'
import { HomeService } from '../data/services.types.ts'
import { ServiceIcon } from './service-icon.tsx'

interface ServiceCardProps {
  service: HomeService
}

export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <a
      href={service.url}
      target="_self"
      rel="noopener noreferrer"
      className="relative group flex flex-col items-center gap-3 p-4 rounded-xl border border-(--border) bg-(--card) hover:border-(--dim) hover:bg-[#111d2e] transition-all duration-150"
      aria-label={`Open ${service.name}`}
    >
      <ServiceIcon service={service} />

      {service.shortcut && (
        <HotKey className="hidden md:block absolute top-2 right-2 text-[11px] uppercase">
          {service.shortcut}
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
