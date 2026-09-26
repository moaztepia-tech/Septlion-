# Production Checklist

- [ ] Put DB behind private network; app DB role must not be superuser/BYPASSRLS.
- [ ] Apply RLS SQL after every Prisma migration and verify migration drift.
- [ ] Move refresh token from JSON response/localStorage to Secure + HttpOnly + SameSite cookie.
- [ ] Add CSRF protection if cookie-based auth is enabled.
- [ ] Configure Google/Microsoft OAuth credentials and identity linking.
- [ ] Add email verification and account recovery.
- [ ] Add rate limits for login, refresh, RFQ creation and quote submission.
- [ ] Put product media in object storage + CDN; never trust arbitrary external URLs in production.
- [ ] Add antivirus/content validation for uploaded documents.
- [ ] Add structured logs, tracing, metrics and error reporting.
- [ ] Add database backups, PITR and restore drills.
- [ ] Add automated RLS isolation tests using two organizations.
- [ ] Add idempotency keys for RFQ, Quote and Order Intent mutations.
- [ ] Add transactional outbox for notifications/webhooks.
- [ ] Add state-transition tests for every business entity.
