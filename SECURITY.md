# EmotiCare AI — Security Policy & Controls (P0)

## 1. Authentication & Authorization Matrix

In EmotiCare AI, client-supplied identities are **never trusted**. 

### Critical Authorization Rule
```
REQUEST -> BEARER JWT TOKEN -> SERVER-SIDE SIGNATURE & CLAIMS VALIDATION
        -> EXTRACTED user_id -> AUTHORIZED DB QUERY (WHERE user_id = :token_user_id)
```

If an endpoint receives a body or query parameter with `user_id: "other_user"`, the server verifies whether `token_user_id == requested_user_id`. Any mismatch raises an immediate `403 Forbidden` error with an audit log event.

### Endpoint Security Matrix
| Endpoint Group | Auth Required | Identity Source | RBAC / Ownership Check |
|---|---|---|---|
| `POST /api/chat` | Optional/Bearer | JWT `sub` if token present | Scoped to authenticated session |
| `GET /api/chat/history` | Required | Server-derived JWT `sub` | Verified owner only |
| `DELETE /api/chat/history` | Required | Server-derived JWT `sub` | Verified owner only |
| `POST /api/mood` | Required | Server-derived JWT `sub` | Strictly isolated |
| `GET /api/mood/history` | Required | Server-derived JWT `sub` | Strictly isolated |
| `GET /api/twin/overview` | Required | Server-derived JWT `sub` | Strictly isolated |
| `POST /api/twin/checkin` | Required | Server-derived JWT `sub` | Strictly isolated |
| `GET /api/personality/profile` | Required | Server-derived JWT `sub` | Strictly isolated |
| `POST /api/personality/assess` | Required | Server-derived JWT `sub` | Strictly isolated |
| `GET /api/memory/center` | Required | Server-derived JWT `sub` | Strictly isolated |
| `POST /api/memory/item` | Required | Server-derived JWT `sub` | Strictly isolated |
| `DELETE /api/memory/item/{id}` | Required | Server-derived JWT `sub` | Verified item ownership |
| `POST /api/privacy/export` | Required | Server-derived JWT `sub` | Machine-readable dump |
| `POST /api/privacy/delete-account`| Required | Server-derived JWT `sub` | Cascading purge |
| `GET /api/safety/plan` | Required | Server-derived JWT `sub` | Strictly isolated |
| `POST /api/safety/plan` | Required | Server-derived JWT `sub` | Strictly isolated |
| `GET /api/safety/trusted-contacts` | Required | Server-derived JWT `sub` | Strictly isolated |
| `POST /api/safety/trusted-contacts`| Required | Server-derived JWT `sub` | Strictly isolated |
| `DELETE /api/safety/trusted-contacts/{id}`| Required | Server-derived JWT `sub` | Verified ownership |
| `GET /api/health` | Public | None | System status only |
| `GET /api/safety/professional-directory` | Public | None | Verified public helpline contacts |

---

## 2. Dev OTP Protection
In previous prototype builds, the OTP generation route returned `dev_otp_code` in JSON responses.
In production:
- `EXPOSE_DEV_OTP` defaults to `0`.
- In `backend/app/auth/routes.py`, `dev_otp_code` is excluded unless `EXPOSE_DEV_OTP=1` is explicitly defined in local development environments.
- Production OTPs are delivered exclusively through verified SMS/Email channels.

---

## 3. Rate Limiting & Abuse Defense
- **Auth Endpoint Throttling**: IP-based rate limiting on `/api/auth/otp/request` and `/api/auth/otp/verify` (max 5 OTP requests per 10-minute window per IP).
- **Automated Testing Exemption**: Controlled via environment variable `TESTING=1`, allowing continuous integration test suites to execute without rate starvation.

---

## 4. Input & File Upload Sanitization
- Avatar photo uploads are validated for valid image headers (MIME types, Pillow image verification).
- Non-image files, executable blobs, or oversized payloads (>10MB) are rejected with `400 Bad Request`.
- In-memory processing ensures no files are written to untracked or publicly reachable disk paths.
