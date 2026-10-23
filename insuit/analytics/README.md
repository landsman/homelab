# Analytics

GTM and GA4 configuration managed by [gtm-code](https://github.com/StackMade/gtm-as-code).

- Edit `analytics.yaml` to declare events, GTM resources, and GA4 resources.
- Set `GTM_ACCOUNT_ID`, `GTM_CONTAINER_ID`, and `GA4_PROPERTY_ID` in your environment
  (see `.env.analytics.example`). Never commit real values into `analytics.yaml`.
- Run `gtm-code validate` to check the config offline.
- Run `gtm-code plan` to preview changes, `gtm-code apply` to apply them.
