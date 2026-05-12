import { ServiceIconName } from './service.icon.ts'

export interface HomeService {
  name: string
  url: string
  icon?: ServiceIconName
  iconWhiteBg?: boolean
  shortcut?: string
}

export interface HomeCategory {
  label: string
  services: HomeService[]
}
