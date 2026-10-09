# Skyway — Cloud-Based Lost & Found Management System for Airports

A working full-stack platform connecting airport passengers with Lost &
Found staff: passengers report lost items and track them to return; staff
register found items, review an automatic (but never automatic-to-return)
matching engine, verify ownership, and close the loop.

This is a real, runnable implementation — not a mockup. It ships with a
working backend, frontend, database, matching engine, notification system,
file uploads, audit logging, tests, seed data, and an AWS deployment
template, and is designed so the exact same backend code can run locally
against SQLite/local disk or in AWS against DynamoDB/S3/Cognito/SES — see
`docs/architecture.md` for why.

## 1. Project overview

- **Passengers** report a lost item (with photos), track its status, review
  any possible matches staff have surfaced, submit ownership proof, and get
  notified at every step.
- **Staff** register found items, search/filter the full lost & found
  inventory, review automatically-generated possible matches (score,
  reasons, differences), confirm or reject them, review ownership proof,
  and mark items returned.
- **Admins** manage staff/passenger accounts, view system-wide statistics,
  and review the full audit log.

## 2. Features

See `docs/deployment.md#final-feature-checklist` for the complete,
checked-off list against the original requirements.

> AWS deployment (single-server route): see `docs/aws-deployment.md`.

## 3. Architecture

Full detail in `docs/architecture.md`. Short version: one Express API,
written against small provider interfaces for database / file storage /
auth / notifications, so it runs locally (SQLite, local disk, JWT, in-app
notifications) or on AWS (DynamoDB, S3, Cognito, SES/SNS) without changing
route or business logic. One React SPA talks to it over a REST API.

## 4. Technology stack

- **Frontend**: React 18, React Router, Tailwind CSS, Vite, Axios
- **Backend**: Node.js, Express, Zod (validation), JWT (`jsonwebtoken`),
  bcrypt (`bcryptjs`), Multer (uploads), Helmet, `express-rate-limit`
- **Database**: SQLite (`better-sqlite3`) locally, designed to map onto
  Amazon DynamoDB in production (see `docs/database.md`)
- **Testing**: Jest + Supertest
- **Infrastructure as code**: AWS SAM (`infrastructure/template.yaml`)

## 5. AWS services

Amazon Cognito (auth), API Gateway + Lambda (compute), DynamoDB (database),
S3 (file storage), SNS + SES (notifications), CloudWatch (monitoring), IAM
(least-privilege access). Full rationale per service in
`docs/architecture.md`.

## 6. Database design

`docs/database.md` — full schema, relationships, indexes, and the DynamoDB
access-pattern mapping.

## 7. API documentation

`docs/api.md` — every endpoint, required role, request/response shape.

## 8. Local setup

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run seed      # creates backend/data/lostfound.db with demo data
npm run dev        # http://localhost:4000

# Frontend (new terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Open `http://localhost:5173`.

## 9. Environment variables

See `.env.example` (repo root, mirrored to `backend/.env.example`) — every
variable is grouped and commented: server, auth, storage, database,
notifications, and matching-engine weights.

## 10. AWS configuration & 11. Deployment steps

`docs/deployment.md` and `infrastructure/README.md` — provisioning with SAM,
wiring outputs into `.env`, and what remains to implement for the
DynamoDB/S3/Cognito/SES adapters (clearly scoped, not hidden).

## 12. Testing

```bash
cd backend
npm test
```

Covers: the matching algorithm (scoring, thresholds, confidence bands),
authentication (registration, login, password hashing), authorization
(role-based access control on protected routes), the full
report → match → ownership verification → return lifecycle end-to-end via
the HTTP API, and file upload validation (type/extension/size, path
safety).

## 13. Demo credentials

After running `npm run seed` in `backend/`, password for every account is
**`Passw0rd!`**:

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@airportlf.com` | |
| Staff (JFK) | `staff.jfk@airportlf.com` | |
| Staff (LAX) | `staff.lax@airportlf.com` | |
| Passenger | `passenger1@example.com` | Has a match already confirmed and awaiting ownership review |
| Passenger | `passenger2@example.com` | No activity yet |
| Passenger | `passenger3@example.com` | Has a possible match awaiting staff review |
| Passenger | `passenger4@example.com` | No activity yet |

## 14. Screenshots

Not included in this text deliverable — run the app locally (section 8) to
see the live UI: the landing page, passenger report form and dashboard,
staff match-review queue, and admin dashboard.

## 15. Limitations

- The DynamoDB/S3/Cognito/SES production adapters are specified, scoped,
  and scaffolded (interfaces + commented AWS SDK calls) but not
  implemented — the tested, runnable path is local SQLite/disk/JWT. This
  keeps the delivered project installable and gradable without requiring
  an AWS account, while still demonstrating the AWS architecture concretely
  via `infrastructure/template.yaml`.
- Matching is deliberately non-AI (token-overlap text similarity plus exact
  field matching) per the project's requirement that basic matching work
  without AI; `docs/architecture.md`/`database.md` note where an AI/embedding
  comparator could be swapped in later.
- Free-text search is SQL `LIKE`-based locally; a DynamoDB deployment would
  need OpenSearch or per-filter composite keys for equivalent search at
  scale.
- No automated frontend component tests; the backend's API tests exercise
  the same user flows end-to-end instead.

## 16. Future enhancements

Designed for, not built into v1 (see requirement #23): AI image similarity,
OCR for ownership documents, multi-airport federated search, a native
mobile app, QR-based claim verification, SMS notifications (SNS is already
wired for this), a multilingual interface, and predictive analytics on
unclaimed-item patterns. None of these are dependencies of the current
matching or return workflow.

## Project structure

```
airport-lost-found/
├── backend/
│   ├── src/
│   │   ├── config/            # env-driven configuration
│   │   ├── db/                 # schema, connection, repository, seed script
│   │   ├── middleware/         # auth, RBAC, validation, error handling
│   │   ├── routes/             # one file per resource
│   │   ├── services/           # matching engine, storage, notifications, audit
│   │   ├── utils/               # jwt, password hashing, id generation
│   │   └── server.js
│   ├── tests/                   # Jest + Supertest
│   └── uploads/                 # local file storage (gitignored)
├── frontend/
│   └── src/
│       ├── api/                 # axios client
│       ├── components/          # shared UI (nav shell, modal, toast, badges)
│       ├── context/              # auth context
│       └── pages/{passenger,staff,admin}/
├── infrastructure/
│   ├── template.yaml             # AWS SAM: API GW, Lambda, DynamoDB, S3, Cognito, SNS, CloudWatch
│   └── README.md
├── docs/
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   └── deployment.md
├── .env.example
└── README.md
```
