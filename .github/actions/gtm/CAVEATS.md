# GTM as code caveats

What gtm-code (`@stackmade/gtm-as-code`, 0.9.2) cannot declare yet, and what this repo does
instead. The aim it gets in the way of: every piece of tracking in one place, the site's
`analytics.yaml`, with no tracking code in the site.

## A click trigger cannot have a condition

In GTM, the usual way to count clicks on some links is a **Click – Just Links** trigger with a
condition, `Click Element matches CSS selector .contact .links a`, and a GA4 event tag on it.
gtm-code's `click` and `linkClick` triggers carry their type and nothing else (checked in
`dist/providers/google/gtm/mapping.js`, 2026-10-24):

```js
if (kind === 'trigger' && BARE_TRIGGER_TYPES.includes(type)) {
    return { name: resourceId, type };
}
```

The GTM API's `filter` field, which holds those conditions, has no key in the YAML, and the
schema refuses unknown keys. A bare `linkClick` fires on every link, internal navigation
included, so a tag on it sends an event per click with nothing to tell the profile links apart.

The same gap sits one step further: an `autoEventVariable` takes only `varType`, so it cannot
read an attribute such as `data-network`. That one has a way round, a `regexTable` variable over
`{{Click URL}}`, which gtm-code does support.

**Instead:** the site pushes its own events. `analytics.yaml` declares them under `events:`,
`make analytics` generates a typed `track()` from that list (`src/app/analytics.gen.ts`), and
the contact page calls `track('social_click', { network })`. That is the approach gtm-code's
README itself recommends, and it has one thing over a selector: renaming a class cannot silently
stop the count, since an e2e test checks every push.

**Once triggers take conditions**, the contact page's tracking moves into `analytics.yaml`:

```yaml
gtm:
  builtInVariables: ['Click Element', 'Click URL']
  variables:
    network:
      type: regexTable
      input: '{{Click URL}}'
      map: { 'linkedin\.com': linkedin, 'github\.com': github, 'x\.com': x, 'bsky\.app': bluesky }
  triggers:
    profile_click:
      type: linkClick
      filter:
        - { variable: '{{Click Element}}', operator: matchesCssSelector, value: '.contact .links a, .contact .links a *' }
  tags:
    social_click:
      type: ga4Event
      eventName: social_click
      trigger: [profile_click]
      parameters: { network: '{{network}}' }
      consent: { status: notNeeded }
```

Then `social_click` leaves `events:`, the page's `onClick` goes, and the e2e test asks GTM's
preview whether the tag fired instead of reading `dataLayer`. A selector is a contract with the
markup that nothing compiles against, so the test is what keeps it.

Upstream: no issue yet; trigger conditions are not in the package's own list of gaps.
