# API `meridian/v1`

Autenticación: cookie + `X-WP-Nonce`.

| Método | Ruta | Cap |
|---|---|---|
| GET | `/bootstrap` | edit pages |
| GET/POST | `/pages` | edit |
| GET/PATCH/DELETE | `/pages/{id}` | edit |
| POST | `/pages/{id}/publish` | publish |
| POST | `/pages/{id}/duplicate` | edit |
| GET | `/pages/{id}/revisions` | edit |
| GET | `/registry` | edit |
| GET/PUT | `/tokens` | manage (PUT) |
| POST | `/tokens/presets/{slug}/activate` | manage |
| GET/PUT | `/menus` `/header` `/footer` `/identity` | manage (PUT) |
| GET/PUT | `/seo` `/settings` | manage |
| CRUD | `/globals` `/templates` | edit |
| CRUD | `/blog` | edit_posts |
| POST | `/export` `/import` | manage |
