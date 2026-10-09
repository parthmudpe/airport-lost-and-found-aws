# Deployment

Two paths are supported: running locally (SQLite/local disk — what you want
for grading/demoing this project), and deploying to AWS (DynamoDB/S3/Cognito
— what the architecture is designed to scale to). See `docs/architecture.md`
for why the codebase supports both from one set of source files.

## 1. Local deployment (recommended for evaluation)

### Prerequisites
- Node.js 18+ and npm
- No AWS account needed

### Backend
```bash
cd backend
cp .env.example .env        # defaults already work out of the box
npm install
npm run seed                 # creates data/lostfound.db with demo data
npm run dev                  # http://localhost:4000  (or: npm start)
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173, proxies /api to :4000
```

Open `http://localhost:5173` and log in with one of the seeded accounts
(see README "Demo credentials"). Uploaded images/documents are written to
`backend/uploads/` and served back through the authenticated `/api/files/:key`
route — never publicly.

### Running the tests
```bash
cd backend
npm test
```

## 2. AWS (serverless) deployment

See `infrastructure/README.md` for the full walkthrough. Summary:

```bash
# 1. Provision AWS resources
cd infrastructure
sam build --template-file template.yaml
sam deploy --guided --stack-name airport-lost-found-dev \
  --parameter-overrides Stage=dev SesFromEmail=you@yourdomain.com \
  --capabilities CAPABILITY_IAM

# 2. Wire the outputs into backend/.env
#    (COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, S3_BUCKET_NAME,
#     SNS_TOPIC_ARN, SES_FROM_EMAIL, and set DB_PROVIDER=dynamodb,
#     STORAGE_PROVIDER=s3, AUTH_PROVIDER=cognito,
#     NOTIFICATION_PROVIDER=ses_sns)

# 3. Implement the DynamoDB/S3/Cognito adapters noted in
#    infrastructure/README.md ("What still needs wiring")

# 4. Build and host the frontend
cd frontend
npm run build
# deploy frontend/dist to Amplify Hosting, or an S3 bucket + CloudFront
```

### Environment variables reference

See `.env.example` at the repo root (mirrored into `backend/.env.example`)
for the complete list, grouped by concern (server, auth, storage, database,
notifications, matching weights).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `npm run seed` fails with a native module build error on `better-sqlite3` | Install build tools for your OS (`xcode-select --install` on macOS, `build-essential` on Debian/Ubuntu, or use a Node version with prebuilt binaries — Node 18/20 LTS is recommended). |
| Frontend loads but API calls 404 | Make sure the backend is running on port 4000 and the frontend dev server's Vite proxy (`vite.config.js`) is pointed at it; in production, set the frontend's API base URL to your deployed API Gateway URL. |
| `401 Unauthorized` right after logging in | The JWT is stored in `localStorage` under `lf_token`; clearing site data or an expired token (`JWT_EXPIRES_IN`, default 8h) will require logging in again. |
| Uploaded images don't show | Confirm `backend/uploads/` is writable, and that you're hitting `/api/files/:key` with a valid Authorization header (the browser `<img>` tag won't send one automatically — the frontend fetches these via the API client). |
| Rate limit errors while testing many requests quickly | Adjust the `express-rate-limit` windows in `backend/src/server.js`, or wait for the window to reset. |
| Matching engine isn't proposing an expected match | Check `MATCH_THRESHOLD_LOW` — scores below it are dropped entirely by design (see `docs/database.md`). Also confirm both items are in the **same category** and **same airport**, which are hard prefilters. |

## Final feature checklist

- [x] Passenger: register/login, report lost item with photos, view reports & status, view possible matches, submit ownership proof, view return status, notifications, logout
- [x] Staff: secure login, dashboard, view lost reports, register found items with photos, search/filter lost & found, review matches (confirm/reject), request/verify ownership, mark returned, audit history
- [x] Admin: manage users (create staff/admin, activate/deactivate), view all records, system statistics, audit logs, airport management
- [x] Role-based access control enforced server-side on every route
- [x] Configurable weighted matching engine, HIGH/MEDIUM/LOW confidence, never auto-declares ownership
- [x] Ownership verification workflow fully separate from the matching score
- [x] In-app notifications for every major lifecycle event; SES/SNS-ready abstraction
- [x] Images/documents stored outside the database, behind an auth-gated (S3-pre-signed-URL-ready) access path
- [x] Password hashing (bcrypt), JWT auth (Cognito-ready), input validation (Zod), rate limiting, security headers (helmet), CORS, audit logging
- [x] REST API covering all required endpoints, documented in `docs/api.md`
- [x] SQLite schema mirrors a documented DynamoDB single-entity-per-table design
- [x] AWS SAM template for API Gateway + Lambda + DynamoDB + S3 + Cognito + SNS + CloudWatch
- [x] Automated tests: matching algorithm, auth, authorization, full lost→match→ownership→return flow, upload validation
- [x] Seed data covering all roles and a realistic in-progress case
- [x] README, architecture.md, database.md, api.md, deployment.md

## Known limitations (see README for the full list)

- The DynamoDB/S3/Cognito/SES adapters are specified and scaffolded
  (commented SDK calls, matching function signatures) but not implemented —
  the delivered, tested, runnable code path is the local SQLite/disk/JWT one.
- Free-text search across lost/found items uses SQL `LIKE`; a production
  DynamoDB deployment would need OpenSearch or composite sort keys for
  equivalent filtering (see `docs/database.md`).
- No automated frontend (React component) tests are included; backend API
  tests cover the same flows end-to-end instead.
