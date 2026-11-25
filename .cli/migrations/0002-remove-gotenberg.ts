import { $ } from 'bun'
import type { Migration } from '#cli/migrations/tool/migrate'

export default {
  description: 'remove the Gotenberg container and its image, the service is gone from the repo',
  hosts: ['nas'],
  async done() {
    return (await $`docker ps -aq -f name=^gotenberg$`.text()).trim() === ''
  },
  async up() {
    await $`docker rm -f gotenberg`
    await $`docker image rm gotenberg/gotenberg:8.39.0`.nothrow()
    await $`rm -rf ${process.env.HOME}/dev/apps/gotenberg`
  },
} satisfies Migration
