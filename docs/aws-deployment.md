# AWS Deployment: Single-Server Route

Architecture: **Amplify Hosting** (React) → HTTPS → **EC2 + Caddy** (Express API, SQLite on disk) → **S3** (private files) and **Cognito** (auth).
DynamoDB and Lambda are *not* used on this route; SQLite stays on the server's disk. (`infrastructure/template.yaml` is the optional serverless variant and is untouched.)

## 0. Implementation status (be honest in your report)

| Feature | Status |
|---|---|
| S3 provider, signed-URL downloads, delete, per-user file access check | Implemented, **untested against real AWS** (unit-tested with mocked SDK) |
| Cognito sign-up/sign-in, ID-token verification, group→role mapping | Implemented, **untested against a real pool** (mocked tests) |
| Local mode (SQLite, disk, JWT) | Unchanged, still the default |
| EC2 / Caddy / Amplify files | Written, **never deployed** |
| CloudWatch | Billing budget + basic EC2 alarms only (steps below). CloudWatch agent / log shipping not set up |
| SES / SNS emails | Not implemented (in-app notifications only) |
| Token refresh | Not implemented: Cognito ID tokens last 1 hour, then the user logs in again |

Run `cd backend && npm install && npm test` first. Tests run offline.

## 1. Costs: verify before you start

As of the July 2025 change, new AWS accounts choose a **Free plan** or **Paid plan** at sign-up and receive credits (reported as $100, plus up to $100 for onboarding tasks) instead of the old 12-month free allowances. The official announcement says the Free plan ends after 6 months or when credits run out. Some third-party guides disagree on credit expiry and which services are blocked, and I did not check the account console, so **confirm in Billing → Free Tier on your own account.**

| Resource | Likely cost treatment (verify) |
|---|---|
| EC2 t3.micro + EBS volume + public IPv4 | Draws from credits; **not** free once credits end |
| S3 (small demo, few photos) | Credits; pennies afterward |
| Cognito | Has a free allowance of monthly active users; confirm current limits and which feature plan the new pool uses |
| Amplify Hosting | Has a free allowance; confirm build minutes / bandwidth limits |
| Data transfer, extra IPs, snapshots | Can cost money; delete what you don't use |

**Avoiding surprises**
1. Choose the **Free plan** at sign-up (it will not bill beyond credits; the account closes instead).
2. Before creating anything: Billing → Budgets → create a **$5 monthly cost budget** with email alerts at 50% and 100%. Turn on Free Tier usage alerts.
3. Use **one region** for everything. Pick the closest to your users (e.g. `ap-south-1` Mumbai for India, `us-east-1` for the US).
4. Stop/terminate the EC2 instance, delete the S3 bucket, Cognito pool and Amplify app when the project is graded.

## 2. S3 bucket
Console → S3 → Create bucket: unique name, same region, **Block all public access = ON**, default encryption SSE-S3. No bucket policy needed.

## 3. Cognito user pool
1. Create user pool (sign-in by **email**). Password policy: 8+ chars, upper-case, number.
2. Create an **app client**: *no client secret*; enable the **ALLOW_USER_PASSWORD_AUTH** flow.
3. Create three **groups** named exactly `PASSENGER`, `STAFF`, `ADMIN`.
4. Create your first admin user in the console, set a permanent password, add to `ADMIN`. (Its local record is created on first login.)
Note the **User pool ID** and **App client ID**.

## 4. EC2 server (Ubuntu 22.04/24.04, t3.micro)
1. Create an **IAM role** for EC2 using `infrastructure/ec2/iam-policy.json` (fill in bucket, region, account ID, pool ID). Attach it as the instance's role. **No access keys anywhere.**
2. Launch the instance with that role. Security group: allow 22 (your IP only), 80 and 443 (anywhere). Do **not** open 4000.
3. Allocate an **Elastic IP** and attach it (otherwise the IP changes on restart).
4. SSH in and run:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs build-essential
sudo apt-get install -y caddy       # if unavailable, follow caddyserver.com/docs/install
sudo mkdir -p /opt/airport-lost-found && sudo chown ubuntu: /opt/airport-lost-found
# copy the project here (git clone or scp), then:
cd /opt/airport-lost-found/backend && npm install --omit=dev
cp .env.example .env && nano .env
```
5. `.env` values for cloud mode:
```
NODE_ENV=production
PORT=4000
CLIENT_URL=https://YOUR-AMPLIFY-URL        # no trailing slash
JWT_SECRET=<openssl rand -hex 32>
AUTH_PROVIDER=cognito
AWS_REGION=<your region>
COGNITO_USER_POOL_ID=<pool id>
COGNITO_CLIENT_ID=<app client id>
STORAGE_PROVIDER=s3
S3_BUCKET_NAME=<bucket>
```
6. Create airports (the report form needs them) and start the service:
```bash
npm run seed:airports            # do NOT run `npm run seed` in cloud mode
sudo cp ../infrastructure/ec2/lostfound.service /etc/systemd/system/
sudo systemctl enable --now lostfound && journalctl -u lostfound -f
```
7. HTTPS: edit `infrastructure/ec2/Caddyfile` (your Elastic IP with dashes + `.nip.io`, or your own domain), copy to `/etc/caddy/Caddyfile`, `sudo systemctl reload caddy`. Test: `https://<host>/api/health`.
   HTTPS is mandatory: Amplify serves over HTTPS and browsers block calls to a plain-HTTP API.

## 5. Frontend on Amplify
1. Push the repo to GitHub. Amplify → Host web app → connect repo; it reads `amplify.yml` (monorepo, `appRoot: frontend`).
2. Environment variable: `VITE_API_URL=https://<your-api-host>/api`.
3. Rewrites and redirects: add a rule *Source* `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>`, *Target* `/index.html`, *Type* `200` (needed for React Router).
4. Copy the Amplify URL into the server's `CLIENT_URL`, then `sudo systemctl restart lostfound`.

`VITE_` values are public by design. Only the API URL goes there, never AWS keys.

## 6. Monitoring
- Budget alert (section 1).
- CloudWatch → Alarms: EC2 `StatusCheckFailed` and `CPUUtilization > 80%` with an email (SNS) action.
- App logs: `journalctl -u lostfound`. Back up `backend/data/lostfound.db` regularly (e.g. weekly EBS snapshot): it is your only database copy.

## 7. Verify end-to-end
Register a passenger → submit a report with a photo (check the object appears in S3, bucket still private) → log in as staff (user in the `STAFF` group) → register a matching found item → confirm match → passenger submits proof → approve → mark returned. Create staff via the admin API/UI so their local record gets an airport.

## Known limitations
- SQLite on one server: no horizontal scaling and no automatic failover.
- Cognito auto-confirm is on for demo convenience (no email verification).
- Seeded demo users do not work in Cognito mode.
- Admin-created staff passwords are set by the admin; staff aren't forced to change them.
