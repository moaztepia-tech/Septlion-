# Working on Septlion

## Publishing www.septlion.com (standing rule from the founder)

- Always publish with `.github/workflows/deploy-hostinger.yml`, `mode = release`
  (the default) and the right `site` (usually `platform`). One run plans and
  publishes with backup, read-back, public check and automatic restore.
- A small change must go live in about two minutes. If a release takes much
  longer, find out why and fix the cause; do not fall back to the slow path.
- Keep what makes it fast: the fixed Next.js build id in `apps/web/next.config.mjs`,
  parallel FTPS transfers, and the live manifest in
  `septlion-release-backups/live-manifest.json` (see `docs/DEPLOY.md`).
- Keep the safety steps: tests, backup, read-back, the 31-page check. Never delete
  files on the server.
- Any change to the live site, a deploy or a production database change needs
  the founder's go-ahead first.
