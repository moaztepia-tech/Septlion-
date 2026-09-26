# SEPTLION Transaction Workspace

Adds commercial documents, contextual messaging, notifications and a transactional outbox.

## Flow
RFQ/Quote/OrderIntent -> Conversation + Documents -> Outbox -> Notifications.

## Object storage
`POST /documents/prepare` creates metadata/storage key. Production must replace the placeholder upload descriptor with a real S3/R2-compatible presigned PUT URL. After upload, the client computes/sends SHA-256 to `/documents/:id/complete`.

## Security
Every workspace query is tenant-scoped. Conversations require explicit organization participation. Document metadata is RLS protected. Never expose internal object-storage credentials to the browser.

## Outbox
Domain writes and OutboxEvent should be committed in the same DB transaction. The included worker demonstrates processing; production should add retry/backoff, dead-letter handling and multi-worker locking with `FOR UPDATE SKIP LOCKED`.
