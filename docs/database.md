# Database Design

The local implementation uses SQLite (`backend/src/db/schema.sql`) as a
practical stand-in for Amazon DynamoDB. This document describes the schema
as implemented, and then how it maps onto DynamoDB for the AWS deployment
in `infrastructure/template.yaml`.

## Entities

### `airports`
| Column | Type | Notes |
|---|---|---|
| id (PK) | TEXT (uuid) | |
| code | TEXT, unique | e.g. `JFK` |
| name, city, country | TEXT | |
| terminals | TEXT (JSON array) | |
| created_at / updated_at | TEXT (ISO 8601) | |

### `users`
| Column | Type | Notes |
|---|---|---|
| id (PK) | TEXT (uuid) | |
| email | TEXT, unique | lower-cased before storage |
| password_hash | TEXT | bcrypt, 10 rounds — never plaintext |
| full_name, phone | TEXT | |
| role | TEXT | `PASSENGER` \| `STAFF` \| `ADMIN` |
| airport_id (FK → airports.id) | TEXT | staff's assigned airport |
| is_active | INTEGER (bool) | admin can deactivate an account |

### `lost_items`
| Column | Notes |
|---|---|
| id (PK) | |
| report_number | human-friendly, e.g. `LF-2026-00001`, unique |
| user_id (FK → users.id) | indexed |
| category, item_name, description, brand, model, color, serial_number, unique_features | |
| date_lost, time_lost | |
| airport_id (FK → airports.id), terminal, location_area, flight_number | indexed on airport_id |
| contact_phone, contact_email | |
| images | JSON array of **storage keys**, never binary data |
| additional_notes | |
| status | `REPORTED → SEARCHING → POSSIBLE_MATCH → MATCH_CONFIRMED → OWNERSHIP_VERIFICATION → RETURNED` (or `CLOSED` / `REJECTED` at various points) — indexed |
| created_at / updated_at | |

### `found_items`
Mirrors `lost_items` with `found_number` (`FD-2026-00001`), `date_found` /
`time_found`, `found_by_staff_id` (FK → users.id), `storage_location`
(physical shelf/locker), and status
`FOUND → IN_STORAGE → POSSIBLE_MATCH → CLAIM_PENDING → OWNERSHIP_VERIFICATION → RETURNED`
(or `UNCLAIMED` / `CLOSED`).

### `matches`
| Column | Notes |
|---|---|
| id (PK) | |
| lost_item_id (FK), found_item_id (FK) | both indexed |
| score | 0–100, from the configurable matching engine |
| confidence | `HIGH` \| `MEDIUM` \| `LOW` |
| reasons, differences | JSON arrays of human-readable strings |
| status | `PENDING_REVIEW → STAFF_CONFIRMED\*/STAFF_REJECTED → OWNERSHIP_PENDING → OWNERSHIP_VERIFIED/OWNERSHIP_REJECTED → COMPLETED` (\*in practice CONFIRM moves straight to `OWNERSHIP_PENDING`, see `routes/matches.js`) — indexed |
| reviewed_by_staff_id (FK → users.id) | |

### `ownership_verifications`
| Column | Notes |
|---|---|
| id (PK) | |
| match_id (FK), lost_item_id (FK), passenger_id (FK) | |
| proof_text | passenger-provided description |
| proof_documents | JSON array of **storage keys** (private) |
| verification_method | `SERIAL_NUMBER` \| `IMEI` \| `UNIQUE_FEATURE` \| `PURCHASE_DETAILS` \| `DOCUMENT` \| `STAFF_QUESTION` |
| status | `REQUESTED → SUBMITTED → STAFF_APPROVED/STAFF_REJECTED` |
| reviewed_by_staff_id, staff_notes | |

### `notifications`
`id, user_id (FK, indexed), type, title, message, related_entity_type,
related_entity_id, is_read (indexed), channel (INAPP/EMAIL/SMS), created_at`.

### `audit_logs`
`id, user_id (FK), role, action, entity_type, entity_id (composite index on
entity_type+entity_id), metadata (JSON), created_at`.

## Relationships

```
airports 1───* users (staff assignment)
airports 1───* lost_items
airports 1───* found_items
users    1───* lost_items                (passenger's own reports)
users    1───* found_items               (staff who logged it)
lost_items  1───* matches ───* found_items   (many-to-many via matches)
matches  1───* ownership_verifications
users    1───* ownership_verifications   (as passenger)
users    1───* notifications
users    1───* audit_logs
```

## Indexes (SQLite implementation)

- `lost_items`: `user_id`, `status`, `airport_id`, `category`
- `found_items`: `status`, `airport_id`, `category`
- `matches`: `lost_item_id`, `found_item_id`, `status`
- `notifications`: `user_id`, `is_read`
- `audit_logs`: `(entity_type, entity_id)`, `user_id`
- `users`: unique on `email`; `airports`: unique on `code`

## DynamoDB access patterns (AWS deployment)

`infrastructure/template.yaml` provisions one table per entity (rather than
a single mega-table) because this system's access patterns are simple
per-entity lookups plus a handful of "list by foreign key" queries — a
single-table design would add join complexity for little benefit at this
scale. Each table uses **on-demand (pay-per-request) billing**.

| Table | Partition key | GSI | Supports |
|---|---|---|---|
| `Users` | `id` | `EmailIndex` (`email`) | login lookup by email; get by id |
| `LostItems` | `id` | `ByUser` (`userId`), `ByAirport` (`airportId`) | passenger's own reports; staff search within an airport |
| `FoundItems` | `id` | `ByAirport` (`airportId`) | staff search within an airport |
| `Matches` | `id` | `ByLostItem` (`lostItemId`) | possible matches for one report |
| `OwnershipVerifications` | `id` | — | fetched by id (referenced from `Matches`/`Notifications`) |
| `Notifications` | `id` | `ByUser` (`userId`) | a user's notification feed |
| `AuditLogs` | `id` | — (scanned/filtered by `entity_type` in small academic-scale data; add a GSI on `entityType` if volume grows) | |
| `Airports` | `id` | — | small reference table, listed in full |

**Free-text search/filter** (staff searching lost/found items by brand,
color, date range, etc.) is the one access pattern DynamoDB does not serve
well natively. In production this is handled by streaming table changes
(DynamoDB Streams) into **Amazon OpenSearch Service** or by adding
composite sort keys per filter combination; the SQLite implementation uses
plain `LIKE`/range queries via `db/repository.js`, which is the seam where
that would plug in.

## Matching engine weight configuration

Weights are environment variables (`config/index.js`), not hardcoded:

```
MATCH_WEIGHT_CATEGORY=15   MATCH_WEIGHT_BRAND=15   MATCH_WEIGHT_MODEL=15
MATCH_WEIGHT_COLOR=10      MATCH_WEIGHT_LOCATION=15
MATCH_WEIGHT_DATETIME=10   MATCH_WEIGHT_DESCRIPTION=10  MATCH_WEIGHT_SERIAL=10
MATCH_THRESHOLD_HIGH=80    MATCH_THRESHOLD_MEDIUM=60    MATCH_THRESHOLD_LOW=40
```

See `backend/src/services/matchingService.js` for the scoring logic.
