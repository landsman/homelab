// Fixtures for mocking https://slack-status.com/api/v2.0.0/current via page.route()
//
// Usage in a Playwright test:
//   import { slackFixtures } from './fixtures/slack'
//   await page.route('https://slack-status.com/api/v2.0.0/current', route =>
//     route.fulfill({ json: slackFixtures.incident })
//   )

export const slackFixtures = {
  ok: {
    status: 'ok',
    date_created: '2026-03-05T08:00:00-08:00',
    date_updated: '2026-03-05T08:00:00-08:00',
    active_incidents: [],
  },

  incident: {
    status: 'active',
    date_created: '2026-03-05T08:00:00-08:00',
    date_updated: '2026-03-05T09:15:00-08:00',
    active_incidents: [
      {
        id: '1234',
        title: 'Messaging Degraded Performance',
        type: 'incident',
        status: 'active',
        url: 'https://slack-status.com/incidents/1234',
        date_created: '2026-03-05T08:00:00-08:00',
        date_updated: '2026-03-05T09:15:00-08:00',
        services: ['Messaging', 'Notifications'],
        notes: [
          {
            date_created: '2026-03-05T09:15:00-08:00',
            body: '<p><strong>Investigating</strong> - We are investigating reports of degraded performance affecting messaging and notifications.</p>',
          },
        ],
      },
    ],
  },

  outage: {
    status: 'active',
    date_created: '2026-03-05T08:00:00-08:00',
    date_updated: '2026-03-05T09:15:00-08:00',
    active_incidents: [
      {
        id: '5678',
        title: 'Slack is down',
        type: 'outage',
        status: 'active',
        url: 'https://slack-status.com/incidents/5678',
        date_created: '2026-03-05T08:00:00-08:00',
        date_updated: '2026-03-05T09:15:00-08:00',
        services: ['Messaging', 'Connectivity', 'Notifications', 'Files'],
        notes: [
          {
            date_created: '2026-03-05T09:15:00-08:00',
            body: '<p><strong>Identified</strong> - We have identified the issue causing a complete service outage and are working on a fix.</p>',
          },
        ],
      },
    ],
  },

  notice: {
    status: 'active',
    date_created: '2026-03-05T08:00:00-08:00',
    date_updated: '2026-03-05T09:15:00-08:00',
    active_incidents: [
      {
        id: '9012',
        title: 'Scheduled Maintenance',
        type: 'notice',
        status: 'scheduled',
        url: 'https://slack-status.com/incidents/9012',
        date_created: '2026-03-05T08:00:00-08:00',
        date_updated: '2026-03-05T09:15:00-08:00',
        services: ['Messaging'],
        notes: [
          {
            date_created: '2026-03-05T09:15:00-08:00',
            body: '<p><strong>Scheduled</strong> - We will be performing maintenance on March 6th from 02:00–04:00 UTC.</p>',
          },
        ],
      },
    ],
  },
}
