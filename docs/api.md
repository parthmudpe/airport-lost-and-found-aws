# API Documentation

Base URL (local): `http://localhost:4000/api`

All endpoints except `/auth/register` and `/auth/login` require
`Authorization: Bearer <JWT>`. Roles required are noted per endpoint.
Request bodies are JSON unless a route accepts file uploads, in which case
it accepts `multipart/form-data` (fields + `images`/`documents` files).

Standard error shape: `{ "error": "message", "details"?: {...} }`. Validation
errors (400) include a `details` object from Zod (`fieldErrors`, `formErrors`).

---

## Auth

### `POST /auth/register`
Public. Creates a **PASSENGER** account only.
```json
{ "email": "a@b.com", "password": "min 8 chars", "fullName": "Jane Doe", "phone": "optional" }
```
→ `201 { token, user }`

### `POST /auth/login`
Public.
```json
{ "email": "a@b.com", "password": "..." }
```
→ `200 { token, user }` / `401` on bad credentials

### `GET /auth/me`
Auth required. → `200 { user }`

### `POST /auth/admin/create-user`
**ADMIN** only. Creates a STAFF or ADMIN account.
```json
{ "email": "...", "password": "...", "fullName": "...", "role": "STAFF|ADMIN", "airportId": "optional" }
```

---

## Lost Items

### `POST /lost-items`
**PASSENGER**. `multipart/form-data`: `category, itemName, dateLost, airportId` required;
`description, brand, model, color, serialNumber, uniqueFeatures, timeLost,
terminal, locationArea, flightNumber, contactPhone, contactEmail,
additionalNotes` optional; `images` (up to 5 files) optional.
Triggers the matching engine against existing found items and creates
`matches` rows + a notification if any are found. → `201 { lostItem }`

### `GET /lost-items`
Auth required.
- **PASSENGER**: returns only the caller's own reports → `{ items }`
- **STAFF/ADMIN**: search/filter/paginate → query params `category, brand,
  model, color, airportId, terminal, status, dateFrom, dateTo, q, page,
  pageSize` → `{ items, total, page, pageSize }`

### `GET /lost-items/:id`
Owner passenger or STAFF/ADMIN. → `{ lostItem }`

### `PUT /lost-items/:id`
Owner passenger (cannot change `status`) or STAFF/ADMIN (can). Partial body
of any creatable field. → `{ lostItem }`

### `DELETE /lost-items/:id`
Owner passenger or STAFF/ADMIN. → `204`

### `GET /lost-items/:id/matches`
Owner passenger or STAFF/ADMIN. Passengers never receive the found item's
full `serial_number` (masked to last 4 characters) or `storage_location`.
→ `{ matches: [{ ...match, foundItem }] }`

---

## Found Items

### `POST /found-items`
**STAFF/ADMIN**. `multipart/form-data`: `category, itemName, dateFound,
airportId` required; `description, brand, model, color, serialNumber,
uniqueFeatures, timeFound, terminal, locationArea, storageLocation`
optional; `images` optional. Triggers matching against open lost reports.
→ `201 { foundItem }`

### `GET /found-items`
**STAFF/ADMIN**. Same filter params as lost items search (`category, brand,
model, color, airportId, terminal, status, q, page, pageSize`).

### `GET /found-items/:id`
**STAFF/ADMIN**. → `{ foundItem }`

### `PUT /found-items/:id`
**STAFF/ADMIN**. Partial update, including `status`.

---

## Matches

### `GET /matches`
**STAFF/ADMIN**. Query: `status` (`PENDING_REVIEW` \| `OWNERSHIP_PENDING` \|
`COMPLETED` \| ...), `page`, `pageSize`. Returns matches enriched with
`lostItem` and `foundItem`.

### `GET /matches/:id`
Owner passenger (via their lost item) or STAFF/ADMIN.

### `GET /matches/:id/ownership-verification`
Owner passenger or STAFF/ADMIN. Returns the current verification record for
this match (or `null`), used by the passenger UI to know which record to
submit proof against.

### `PUT /matches/:id`
**STAFF/ADMIN**. Confirm or reject a possible match.
```json
{ "action": "CONFIRM" | "REJECT", "notes": "optional" }
```
`CONFIRM` **never** returns the item — it only opens ownership verification
(creates an `ownership_verifications` row, sets match status to
`OWNERSHIP_PENDING`). `REJECT` returns the lost report to `SEARCHING`.

---

## Ownership Verification

### `GET /ownership-verification/:id`
Owner passenger or STAFF/ADMIN.

### `PUT /ownership-verification/:id`
**PASSENGER** (must be the report's owner). `multipart/form-data`:
`proofText` (required), `verificationMethod` (optional enum),
`documents` (up to 5 files). Sets status to `SUBMITTED`.

### `POST /ownership-verification/:id/review`
**STAFF/ADMIN**.
```json
{ "approved": true, "notes": "optional" }
```
Approving sets the match to `OWNERSHIP_VERIFIED`, the lost item to
`MATCH_CONFIRMED`, the found item to `CLAIM_PENDING`, and notifies the
passenger (`OWNERSHIP_VERIFIED` + `ITEM_READY_FOR_COLLECTION`). Rejecting
returns the lost report to `SEARCHING`.

### `POST /ownership-verification/:id/mark-returned`
**STAFF/ADMIN**. Only valid once `status = STAFF_APPROVED`. This is the
only endpoint that sets a lost item to `RETURNED`.

---

## Notifications

### `GET /notifications?unreadOnly=true|false`
Auth required. Returns the caller's own notifications.

### `PUT /notifications/:id/read`
Auth required, must own the notification.

---

## Dashboards

### `GET /dashboard/passenger` — **PASSENGER**
`{ activeReports, possibleMatches, underVerification, readyForCollection,
returnedItems, reports, notifications }`

### `GET /dashboard/staff` — **STAFF/ADMIN**
`{ totalLostReports, totalFoundItems, possibleMatches,
pendingOwnershipVerification, itemsReturned, unclaimedItems, lostByStatus,
foundByStatus, matchByStatus }`

### `GET /dashboard/admin` — **ADMIN**
`{ totalUsers, totalLostItems, totalFoundItems, matchRate,
successfulReturns, pendingCases, recentActivity }`

---

## Audit Logs

### `GET /audit-logs`
**STAFF/ADMIN**. Query: `page, pageSize, entityType, userId`.
→ `{ items, total, page, pageSize }`

---

## Admin

### `GET /admin/users?role=PASSENGER|STAFF|ADMIN`
**ADMIN**.

### `PUT /admin/users/:id/active`
**ADMIN**. `{ "isActive": true|false }`

---

## Airports

### `GET /airports`
Auth required (any role). Used to populate the airport/terminal picker.

### `POST /airports`
**ADMIN**. `{ code, name, city, country, terminals: [] }`

---

## Files

### `GET /files/:key`
Auth required. Local-dev-only stand-in for an S3 pre-signed URL; streams the
file identified by its opaque storage key. In AWS mode the frontend instead
receives a real S3 pre-signed URL directly and this route is not used.

---

## Rate limits (see `server.js`)

- All `/api/*`: 300 requests / 15 min / IP
- `/api/auth/login`: 20 / 15 min / IP
- `/api/auth/register`: 10 / hour / IP
