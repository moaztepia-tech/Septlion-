# Core API

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/organizations`
- `POST /api/auth/switch-organization`
- `GET /api/sectors`
- `GET /api/catalog/public`
- `GET /api/catalog/public/sku/:id`
- `GET /api/catalog/me/sku/:id`
- `POST /api/rfq`
- `GET /api/rfq/mine`
- `GET /api/rfq/:id`
- `PATCH /api/rfq/:id/status/:status`
- `POST /api/quotes`
- `GET /api/quotes/mine`
- `GET /api/quotes/:id`
- `POST /api/order-intents/:quoteId`
- `GET /api/order-intents/mine`

All protected endpoints require `Authorization: Bearer <accessToken>`.
