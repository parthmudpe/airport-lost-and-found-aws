# Infrastructure

This folder contains the AWS deployment reference for the production/serverless
version of the system. It is not required to run the project locally — see the
root `README.md` for that.

## Contents

- `template.yaml` — an AWS SAM (Serverless Application Model) template that
  provisions: API Gateway, a Lambda function wrapping the Express app,
  DynamoDB tables (one per entity, mirroring `backend/src/db/schema.sql`),
  a private S3 bucket for images/documents, a Cognito User Pool with
  `PASSENGER` / `STAFF` / `ADMIN` groups, an SNS topic for notifications, and
  CloudWatch alarms on API 5xx and Lambda errors.

## Why this shape (trade-offs)

The project requirements ask for a scalable, mostly-serverless AWS
architecture, but also for something an academic reviewer can stand up and
run without a deployment pipeline. This repo resolves that by keeping one
Express codebase in `backend/` and giving it two run modes:

| Mode | Command | DB | Storage | Auth | Notifications |
|---|---|---|---|---|---|
| Local / grading | `npm start` in `backend/` | SQLite | Local disk | JWT (local) | In-app only |
| AWS / production | Deploy `template.yaml` | DynamoDB | S3 | Cognito | SES + SNS |

Every service the routes call (`db/repository.js`, `services/storageService.js`,
`services/notificationService.js`, `middleware/auth.js`) is written against a
small interface rather than a specific vendor SDK, so switching modes is a
matter of environment variables plus implementing the DynamoDB/S3/Cognito
branch of that same interface — not a rewrite. This was chosen over a
DynamoDB-only implementation because a from-scratch AWS account with Cognito,
DynamoDB and S3 already provisioned cannot be assumed for grading, while a
`npm install && npm run seed && npm start` local path can.

## Deploying to AWS

Prerequisites: an AWS account, the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html), and a verified SES sender identity if you want real emails.

```bash
cd infrastructure
sam build --template-file template.yaml
sam deploy --guided \
  --stack-name airport-lost-found-dev \
  --parameter-overrides Stage=dev SesFromEmail=notifications@yourdomain.com \
  --capabilities CAPABILITY_IAM
```

`sam deploy --guided` will prompt for and then remember your stack
parameters in `samconfig.toml`. After it finishes, note the `ApiUrl`,
`UserPoolId`, `UserPoolClientId`, `AssetsBucketName` and
`NotificationsTopicArn` outputs — put them into the frontend/backend `.env`
files per `.env.example`.

### What still needs wiring before this is production-ready

1. **Lambda handler**: add a thin `backend/lambda.js` using
   `serverless-http` to adapt the existing `src/server.js` Express app for
   API Gateway, and point `template.yaml`'s `ApiFunction.Handler` at it.
2. **DynamoDB repository implementation**: implement the same function
   signatures as `backend/src/db/repository.js` against `@aws-sdk/client-dynamodb`
   / `@aws-sdk/lib-dynamodb`, following the access patterns in
   `docs/database.md`.
3. **S3 provider**: uncomment the `s3Provider` block in
   `backend/src/services/storageService.js` and set `STORAGE_PROVIDER=s3`.
4. **Cognito auth**: verify the incoming JWT against the User Pool's JWKS in
   `middleware/auth.js` instead of `utils/jwt.js`'s local HMAC verification,
   and read the role from a Cognito group / custom attribute.
5. **SES/SNS**: uncomment the AWS SDK calls in
   `backend/src/services/notificationService.js` and set
   `NOTIFICATION_PROVIDER=ses_sns`.
6. **Frontend hosting**: build the frontend (`npm run build` in `frontend/`)
   and deploy `frontend/dist` to AWS Amplify Hosting or an S3 + CloudFront
   distribution; point its `VITE_API_URL`/proxy at the API Gateway URL above.
7. Tighten the S3 CORS `AllowedOrigins` and API Gateway CORS origin to your
   real frontend domain before going beyond a personal/academic demo.
