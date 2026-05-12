import { Hotkey } from '../../common/hotkey/hotkey.ts'
import { HomeCategory } from './services.types.ts'
import { ServiceIcon } from './service.icon.ts'

export const HOME_CATEGORIES: HomeCategory[] = [
  {
    label: 'Free time',
    services: [
      {
        name: 'Hacker News',
        url: 'https://news.ycombinator.com',
        icon: ServiceIcon.HACKERNEWS,
        shortcut: Hotkey.Y,
      },
      { name: 'Medium', url: 'https://medium.com', icon: ServiceIcon.MEDIUM, shortcut: Hotkey.D },
      {
        name: 'Substack',
        url: 'https://substack.com',
        icon: ServiceIcon.SUBSTACK,
      },
      { name: 'Reddit', url: 'https://reddit.com', icon: ServiceIcon.REDDIT, shortcut: Hotkey.R },
      { name: 'Nyx', url: 'https://www.nyx.cz', icon: ServiceIcon.NYX, shortcut: Hotkey.X },
      { name: 'Bluesky', url: 'https://bsky.app', icon: ServiceIcon.BLUESKY, shortcut: Hotkey.B },
      { name: 'X', url: 'https://x.com', icon: ServiceIcon.X },
      {
        name: 'Polymarket',
        url: 'https://polymarket.com',
        icon: ServiceIcon.POLYMARKET,
        shortcut: Hotkey.E,
      },
      {
        name: 'Discord',
        url: 'https://discord.com/app',
        icon: ServiceIcon.DISCORD,
        shortcut: Hotkey.I,
      },
    ],
  },
  {
    label: 'LLM',
    services: [
      { name: 'Claude', url: 'https://claude.ai', icon: ServiceIcon.CLAUDE, shortcut: Hotkey.C },
      {
        name: 'Perplexity',
        url: 'https://perplexity.ai',
        icon: ServiceIcon.PERPLEXITY,
        shortcut: Hotkey.P,
      },
      {
        name: 'Gemini',
        url: 'https://gemini.google.com',
        icon: ServiceIcon.GEMINI,
        shortcut: Hotkey.G,
      },
      {
        name: 'NotebookLM',
        url: 'https://notebooklm.google.com',
        icon: ServiceIcon.NOTEBOOKML,
        shortcut: Hotkey.N,
      },
    ],
  },
  {
    label: 'Development',
    services: [
      { name: 'GitHub', url: 'https://github.com', icon: ServiceIcon.GITHUB, shortcut: Hotkey.H },
      { name: 'GitLab', url: 'https://gitlab.com', icon: ServiceIcon.GITLAB, shortcut: Hotkey.L },
      { name: 'Figma', url: 'https://figma.com', icon: ServiceIcon.FIGMA, shortcut: Hotkey.F },
      {
        name: 'Photopea',
        url: 'https://www.photopea.com',
        icon: ServiceIcon.PHOTOPEA,
        shortcut: Hotkey.U,
      },
      { name: 'Grep', url: 'https://grep.app', icon: ServiceIcon.GREP_VERCEL, shortcut: Hotkey.W },
      { name: 'Vaadin Docs', url: 'https://vaadin.com/docs', icon: ServiceIcon.VAADIN },
      { name: 'Azure DevOps', url: 'https://dev.azure.com', icon: ServiceIcon.AZURE_DEVOPS },
      {
        name: 'Supabase',
        url: 'https://supabase.com/dashboard/projects',
        icon: ServiceIcon.SUPABASE,
      },
    ],
  },
  {
    label: 'Audio / Video',
    services: [
      {
        name: 'Discogs',
        url: 'https://www.discogs.com/mywantlist',
        icon: ServiceIcon.DISCOGS,
        iconWhiteBg: true,
        shortcut: Hotkey.V,
      },
      {
        name: 'YouTube Music',
        url: 'https://music.youtube.com',
        icon: ServiceIcon.YOUTUBE_MUSIC,
      },
      {
        name: 'YouTube',
        url: 'https://www.youtube.com/playlist?list=WL',
        icon: ServiceIcon.YOUTUBE,
        shortcut: Hotkey.SHIFT_Y,
      },
      {
        name: 'Last.fm',
        url: 'https://www.last.fm/user/insuit',
        icon: ServiceIcon.LASTFM,
        shortcut: Hotkey.M,
      },
    ],
  },
  {
    label: 'Personal',
    services: [
      {
        name: 'Google Keep',
        url: 'https://keep.google.com',
        icon: ServiceIcon.GOOGLE_KEEP,
        shortcut: Hotkey.K,
      },
      {
        name: 'Google Calendar',
        url: 'https://calendar.google.com',
        icon: ServiceIcon.GOOGLE_CALENDAR,
        shortcut: Hotkey.A,
      },
      {
        name: 'Apple Notes',
        url: 'https://www.icloud.com/notes',
        icon: ServiceIcon.APPLE_NOTES,
        shortcut: Hotkey.J,
      },
      {
        name: 'Find My',
        url: 'https://www.icloud.com/find',
        icon: ServiceIcon.APPLE_FIND_MY,
      },
    ],
  },
  {
    label: 'Homelab',
    services: [
      {
        name: 'Readeck',
        url: 'https://read.insuit.cz',
        icon: ServiceIcon.READECK,
        shortcut: Hotkey.Q,
      },
      {
        name: 'Eat',
        url: 'https://eat.insuit.cz',
        icon: ServiceIcon.MEALIE,
        shortcut: Hotkey.SHIFT_Q,
      },
      {
        name: 'Music',
        url: 'https://music.insuit.cz',
        shortcut: Hotkey.SHIFT_W,
      },
      {
        name: 'Forgejo',
        url: 'https://git.insuit.cz',
        icon: ServiceIcon.FORGEJO,
        shortcut: Hotkey.SHIFT_E,
      },
      {
        name: 'YT Archive',
        url: 'https://nas.dog-macaroni.ts.net/yt-archive/',
        icon: ServiceIcon.METUBE,
      },
      {
        name: 'Raspberry Connect',
        url: 'https://connect.raspberrypi.com',
        icon: ServiceIcon.RASPBERRY_CONNECT,
        shortcut: Hotkey.O,
      },
      {
        name: 'Cloudflare',
        url: 'https://dash.cloudflare.com',
        icon: ServiceIcon.CLOUDFLARE,
        shortcut: Hotkey.SHIFT_R,
      },
      {
        name: 'Tailscale',
        url: 'https://login.tailscale.com/admin',
        icon: ServiceIcon.TAILSCALE,
      },
    ],
  },
  {
    label: 'Work',
    services: [
      { name: 'Slack', url: 'https://slack.com', icon: ServiceIcon.SLACK, shortcut: Hotkey.S },
      { name: 'Toggl', url: 'https://toggl.com', icon: ServiceIcon.TOGGL, shortcut: Hotkey.T },
      { name: 'Fizzy', url: 'https://www.fizzy.do', icon: ServiceIcon.FIZZY, shortcut: Hotkey.Z },
    ],
  },
]
