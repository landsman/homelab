import { $ } from 'bun'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import type { Migration } from '#cli/migrate'

const app = `${homedir()}/dev/apps/authelia`
const config = `${app}/configuration.yml`

export default {
  description:
    'restart Authelia, so it reads configuration.yml with the token endpoint rate limit off',
  hosts: ['nas'],
  // Started after the file last changed. ctime, not mtime: rsync -a keeps the laptop's mtime,
  // while ctime is when the file landed here.
  async done() {
    if (!limitIsOff()) return false
    const started = await $`docker inspect -f {{.State.StartedAt}} authelia`.text()
    return new Date(started.trim()) > statSync(config).ctime
  },
  async up() {
    if (!limitIsOff()) {
      throw new Error('configuration.yml here still has the limit: `make rsync` in authelia/ first')
    }
    await $`docker compose restart authelia`.cwd(app)
  },
} satisfies Migration

function limitIsOff() {
  return /openid_connect_token:\s*\n\s*enable: false/.test(readFileSync(config, 'utf8'))
}
