import { ServiceIconName } from './service.icon.ts'

export interface HomeService {
  name: string
  url: string
  icon?: ServiceIconName
  iconWhiteBg?: boolean
  shortcut?: string
  /** Extra words the search matches besides the name. */
  tags?: string[]
}

export interface HomeCategory {
  label: string
  services: HomeService[]
}
