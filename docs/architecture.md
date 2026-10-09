# Architecture

## Overview

Skyway Lost & Found is a single Express API plus a single React SPA. The API
is written against small provider interfaces (database, file storage,
authentication, notifications) rather than directly against SQLite or the
AWS SDK, so the same code runs two ways:

- **Local / academic evaluation mode** (default): SQLite, local-disk file
  storage, local JWT auth, in-app notifications. Runs with `npm install &&
  npm start`, no AWS account required.
- **AWS production mode**: DynamoDB, S3, Cognito, SES/SNS, deployed via the
  SAM template in `infrastructure/template.yaml`.

```
                         ┌─────────────────────────┐
   Passenger / Staff /   │   React SPA (frontend/) │
   Admin (browser)  ───► │  Vite build, Tailwind   │
                         └────────────┬────────────┘
                                      │ HTTPS / JSON (+ multipart for uploads)
                                      ▼
                    ┌───────────────────────────────────┐
                    │   Express API (backend/src)        │
                    │  routes/ → middleware/ → services/  │
                    └───┬───────┬───────────┬────────────┘
                        │       │           │
             ┌──────────┘       │           └────────────┐
             ▼                  ▼                         ▼
     db/repository.js   services/storageService.js  services/notificationService.js
       (SQLite today /          (local disk today /        (in-app today /
        DynamoDB in prod)        S3 in prod)                 SES/SNS in prod)
```

## AWS services and why each is used

| Concern | Service | Why |
|---|---|---|
| Frontend hosting | Amplify Hosting or S3 + CloudFront | Serves the built React SPA globally with HTTPS and caching; no server to manage. |
| API compute | API Gateway + Lambda | Pay-per-request, auto-scaling compute for the Express app; no idle server cost for a bursty airport workload. |
| Auth | Amazon Cognito | Managed user directory, password hashing/rotation, JWT issuance, and group-based roles (PASSENGER/STAFF/ADMIN) without building auth infrastructure ourselves. |
| Database | Amazon DynamoDB | Serverless, scales automatically with traffic, pairs naturally with Lambda (no connection pool exhaustion), and the access patterns here (fetch by id, by user, by airport, by status) map cleanly onto DynamoDB GSIs — see `database.md`. |
| File storage | Amazon S3 | Durable object storage for item photos and ownership-proof documents; never stores binary data in the database. Kept fully private, served only via pre-signed URLs. |
| Notifications | Amazon SNS + SES | SNS for pub/sub style fan-out (e.g. future SMS), SES for transactional email (match found, ownership verified, item returned). |
| Monitoring | CloudWatch | Metrics/alarms on API 5xx rate and Lambda errors (see `template.yaml`), plus Lambda's built-in structured logs for debugging. |
| Security | IAM + Cognito + private S3 | Least-privilege roles per Lambda (`DynamoDBCrudPolicy`, `S3CrudPolicy`, scoped to this app's resources only); S3 bucket has `BlockPublicAcls`/`BlockPublicPolicy` on. |

## Cloud computing concepts demonstrated

- **Serverless compute**: API Gateway + Lambda scale to zero and scale out
  automatically; no server provisioning or patching.
- **Cloud-native database**: DynamoDB's pay-per-request billing and
  automatic partitioning handle unpredictable airport traffic (e.g. a
  holiday travel spike) without capacity planning.
- **Object storage**: S3 decouples large binary assets from the
  transactional database, is durable (11 nines), and is only ever reached
  through short-lived pre-signed URLs — never public.
- **Managed identity**: Cognito removes the need to build/maintain password
  storage, MFA, or token issuance.
- **Event/notification architecture**: SNS/SES let the notification path be
  swapped or extended (e.g. add SMS via SNS, or push notifications) without
  touching business logic, because callers only ever call
  `notificationService.notify(...)`.
- **Observability**: CloudWatch alarms give an operational signal
  independent of any one request.
- **Scalability & fault tolerance**: every compute and storage component
  above is a managed, multi-AZ AWS service; the stateless Lambda function
  can be safely invoked concurrently, and DynamoDB/S3 replicate data across
  availability zones automatically.

## Why not a "pure" DynamoDB implementation for the delivered code?

The delivered backend runs against SQLite by default so it can be installed,
seeded, and graded in minutes without an AWS account, IAM setup, or deployed
resources. Every data-access call goes through `db/repository.js`, and every
storage/notification call goes through `services/storageService.js` /
`services/notificationService.js` — these are the seams where a DynamoDB,
S3, and Cognito/SES/SNS implementation plugs in for production, following
the access patterns and IAM policies already defined in
`infrastructure/template.yaml` and `docs/database.md`. This is a standard
"hexagonal"/ports-and-adapters approach: the routes and matching engine
never change when the adapter changes.

## Request flow: lost item → match → ownership → return

1. Passenger `POST /lost-items` → row created, images uploaded to storage
   provider, `LOST_REPORT_SUBMITTED` notification sent, matching engine runs
   against existing found items at the same airport.
2. If the engine finds candidates ≥ the LOW threshold, `matches` rows are
   created and the passenger gets `POSSIBLE_MATCH_FOUND`. The lost item
   status becomes `POSSIBLE_MATCH`. **No ownership is assumed.**
3. Staff review the match in `/staff/matches` (score, reasons, differences)
   and either reject it (report returns to `SEARCHING`) or confirm it — this
   only advances the match to `OWNERSHIP_PENDING` and creates an
   `ownership_verifications` row; nothing is released yet.
4. Passenger submits proof (`PUT /ownership-verification/:id`); staff review
   and approve/reject (`POST /ownership-verification/:id/review`).
5. Only after staff approval can `POST /ownership-verification/:id/mark-returned`
   be called, which is the single place the lost item status becomes
   `RETURNED`.

Every step writes an audit log row (`services/auditService.js`) and fires an
in-app (and, in AWS mode, email) notification.
