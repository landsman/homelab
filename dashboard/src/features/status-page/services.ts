export const SERVICE_TYPE = {
  ATLASSIAN: 'atlassian',
  STATUSIO: 'statusio',
  INSTATUS: 'instatus',
  BETTERSTACK: 'betterstack',
  GOOGLE_WORKSPACE: 'google-workspace',
  INCIDENTIO: 'incidentio',
  SLACK: 'slack',
  REDIRECT: 'redirect',
  SIMPLE_CHECK: 'simple-check',
  UPTIME_KUMA: 'uptime-kuma',
} as const

export type ServiceType = (typeof SERVICE_TYPE)[keyof typeof SERVICE_TYPE]
export const SERVICE_SECTION = {
  EXTERNAL: 'external',
  HOMELAB: 'homelab',
} as const

export type ServiceSection = (typeof SERVICE_SECTION)[keyof typeof SERVICE_SECTION]

export interface Service {
  name: string
  url: string
  healthCheckUrl?: string
  type: ServiceType
  section?: ServiceSection
  statusioId?: string
  icon?: string // filename stem in /icons/, defaults to name.toLowerCase()
  versionPath?: string
  hiddenComponents?: string[]
  keywords?: string[]
  uptimeKumaSlug?: string
}

export const SERVICES: Service[] = [
  {
    name: 'Codeberg',
    url: 'https://status.codeberg.org',
    type: SERVICE_TYPE.UPTIME_KUMA,
    uptimeKumaSlug: 'codeberg',
    keywords: ['git', 'codeberg', 'forgejo'],
  },
  {
    name: 'GitHub',
    url: 'https://www.githubstatus.com',
    type: SERVICE_TYPE.ATLASSIAN,
    hiddenComponents: ['Visit www.githubstatus.com for more information'],
    keywords: ['git', 'github'],
  },
  {
    name: 'GitLab',
    url: 'https://status.gitlab.com',
    type: SERVICE_TYPE.STATUSIO,
    statusioId: '5b36dc6502d06804c08349f7',
    hiddenComponents: ['Website'],
    keywords: ['git', 'gitlab'],
  },
  {
    name: 'Claude',
    url: 'https://status.claude.com',
    type: SERVICE_TYPE.ATLASSIAN,
    keywords: ['ai'],
  },
  {
    name: 'JetBrains AI',
    url: 'https://status.jetbrains.ai',
    type: SERVICE_TYPE.ATLASSIAN,
    icon: 'jetbrains-ai',
    keywords: ['ai'],
  },
  {
    name: 'Docker',
    url: 'https://www.dockerstatus.com',
    type: SERVICE_TYPE.STATUSIO,
    statusioId: '533c6539221ae15e3f000031',
    keywords: ['devops'],
  },
  {
    name: 'npm',
    url: 'https://status.npmjs.org',
    type: SERVICE_TYPE.ATLASSIAN,
    keywords: ['node'],
  },
  {
    name: 'Maven',
    url: 'https://status.maven.org',
    type: SERVICE_TYPE.ATLASSIAN,
    keywords: ['java'],
  },
  {
    name: 'Better Stack',
    url: 'https://status.betterstack.com',
    type: SERVICE_TYPE.BETTERSTACK,
    icon: 'betterstack',
    keywords: ['monitoring', 'uptime', 'status', 'logs', 'telemetry', 'observability'],
  },
  {
    name: 'Perplexity',
    url: 'https://status.perplexity.com',
    type: SERVICE_TYPE.INSTATUS,
    keywords: ['ai'],
  },
  {
    name: 'Figma',
    url: 'https://status.figma.com',
    type: SERVICE_TYPE.ATLASSIAN,
    keywords: ['ui'],
  },
  {
    name: 'Toggl',
    url: 'https://status.toggl.com',
    type: SERVICE_TYPE.ATLASSIAN,
    keywords: ['tracking', 'time', 'money'],
  },
  {
    name: 'Cloudflare',
    url: 'https://www.cloudflarestatus.com',
    type: SERVICE_TYPE.ATLASSIAN,
    icon: 'cloudflare',
    keywords: ['cloud', 'dns', 'cache', 'proxy', 'vpn'],
  },
  {
    name: '37signals',
    url: 'https://www.37status.com',
    type: SERVICE_TYPE.ATLASSIAN,
    icon: '37signals',
    keywords: ['tasks', 'issues', 'tracking'],
  },
  {
    name: 'Jira',
    url: 'https://jira-software.status.atlassian.com',
    type: SERVICE_TYPE.ATLASSIAN,
    keywords: ['tasks', 'issues'],
  },
  {
    name: 'Confluence',
    url: 'https://confluence.status.atlassian.com',
    type: SERVICE_TYPE.ATLASSIAN,
    keywords: ['wiki', 'docs'],
  },
  {
    name: 'Google Workspace',
    url: 'https://www.google.com/appsstatus/dashboard/',
    type: SERVICE_TYPE.GOOGLE_WORKSPACE,
    icon: 'google-workspace',
    keywords: ['google', 'workspace', 'calendar', 'docs', 'drive', 'gmail', 'meet', 'chat'],
  },
  // Tailscale uses incident.io for their status page, which exposes a Statuspage-compatible
  // API at /api/v2/summary.json — same schema as Atlassian Statuspage, so ATLASSIAN type works.
  {
    name: 'Tailscale',
    url: 'https://status.tailscale.com',
    type: SERVICE_TYPE.ATLASSIAN,
    icon: 'tailscale',
    keywords: ['vpn', 'network', 'mesh'],
  },
  {
    name: 'AWS',
    url: 'https://health.aws.amazon.com/health/status',
    type: SERVICE_TYPE.REDIRECT,
    icon: 'aws',
    keywords: ['cloud', 'aws', 'amazon', 'infrastructure'],
  },
  // RSS feed available: https://rssfeed.azure.status.microsoft/en-us/status/feed/, https://status.cloud.microsoft/
  {
    name: 'Azure',
    url: 'https://azure.status.microsoft/en-us/status/',
    type: SERVICE_TYPE.REDIRECT,
    icon: 'ms-azure',
    keywords: ['cloud', 'azure', 'microsoft', 'infrastructure', 'devops'],
  },
  {
    name: 'Slack',
    url: 'https://slack-status.com',
    type: SERVICE_TYPE.SLACK,
    keywords: ['chat', 'messaging', 'communication', 'im'],
  },
  {
    name: 'Readeck',
    url: 'https://read.insuit.cz',
    type: SERVICE_TYPE.SIMPLE_CHECK,
    section: SERVICE_SECTION.HOMELAB,
    keywords: ['read', 'later', 'bookmarks', 'readeck'],
  },
  {
    name: 'Forgejo',
    url: 'https://git.insuit.cz',
    type: SERVICE_TYPE.SIMPLE_CHECK,
    section: SERVICE_SECTION.HOMELAB,
    keywords: ['git'],
  },
  {
    name: 'Music',
    url: 'https://music.insuit.cz',
    type: SERVICE_TYPE.SIMPLE_CHECK,
    section: SERVICE_SECTION.HOMELAB,
    keywords: ['spotify', 'lastfm', 'mp3'],
  },
  {
    name: 'YT Archive',
    url: 'https://nas.dog-macaroni.ts.net/yt-archive/',
    healthCheckUrl: 'https://nas.dog-macaroni.ts.net/yt-archive/version',
    versionPath: 'version',
    type: SERVICE_TYPE.SIMPLE_CHECK,
    section: SERVICE_SECTION.HOMELAB,
    icon: 'metube',
    keywords: ['youtube', 'metube', 'download', 'archive'],
  },
]
