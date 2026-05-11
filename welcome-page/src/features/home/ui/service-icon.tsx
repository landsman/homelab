import { Image } from '../../../app/components/image'

interface ServiceIconProps {
  service: {
    name: string
    icon?: string
    iconWhiteBg?: boolean
  }
}

export function ServiceIcon({ service }: ServiceIconProps) {
  const iconPath = service.icon ? `/icons/services/${service.icon}.svg` : null
  return (
    <div
      className={`w-10 h-10 mt-3 flex items-center justify-center rounded-lg border-b border-white/20 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg ${
        service.iconWhiteBg
          ? 'bg-slate-200 group-hover:bg-slate-200'
          : 'bg-(--dim) group-hover:bg-[#1e3050]'
      }`}
    >
      {iconPath ? (
        <Image src={iconPath} alt={service.name} aria-hidden="true" className="w-5 h-5" />
      ) : (
        <span className="text-sm font-semibold text-(--text-dim)">
          {service.name[0].toUpperCase()}
        </span>
      )}
    </div>
  )
}
