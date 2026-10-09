const config = require('../config');

// ------------------------------------------------------------------
// Amazon Cognito integration (AUTH_PROVIDER=cognito).
//  - verifyIdToken: validates a Cognito ID token's signature, issuer,
//    audience and expiry against the user pool's public keys.
//  - roleFromGroups: maps Cognito groups -> app roles. Roles come ONLY
//    from the verified token, never from the request body.
//  - sign-up / sign-in / admin user creation use the AWS SDK from the
//    backend, so the frontend never holds AWS credentials.
// SDK packages are required lazily so local mode needs none of them.
// ------------------------------------------------------------------

const ROLE_PRIORITY = ['ADMIN', 'STAFF', 'PASSENGER'];

function roleFromGroups(groups) {
  const list = Array.isArray(groups) ? groups : [];
  return ROLE_PRIORITY.find((r) => list.includes(r)) || 'PASSENGER'; // least privilege default
}

let verifier;
function getVerifier() {
  if (!verifier) {
    const { CognitoJwtVerifier } = require('aws-jwt-verify');
    verifier = CognitoJwtVerifier.create({
      userPoolId: config.auth.cognito.userPoolId,
      clientId: config.auth.cognito.clientId,
      tokenUse: 'id',
    });
  }
  return verifier;
}

async function verifyIdToken(token) {
  return getVerifier().verify(token);
}

let idp;
function client() {
  if (!idp) {
    const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');
    idp = new CognitoIdentityProviderClient({ region: config.auth.cognito.region });
  }
  return idp;
}
const sdk = () => require('@aws-sdk/client-cognito-identity-provider');
const poolId = () => config.auth.cognito.userPoolId;
const clientId = () => config.auth.cognito.clientId;

async function addToGroup(email, group) {
  const { AdminAddUserToGroupCommand } = sdk();
  await client().send(new AdminAddUserToGroupCommand({ UserPoolId: poolId(), Username: email, GroupName: group }));
}

// Passenger self-registration. Auto-confirms so the demo needs no email
// round-trip; remove AdminConfirmSignUp to require email verification.
async function signUpPassenger({ email, password, fullName }) {
  const { SignUpCommand, AdminConfirmSignUpCommand } = sdk();
  await client().send(new SignUpCommand({
    ClientId: clientId(), Username: email, Password: password,
    UserAttributes: [{ Name: 'email', Value: email }, { Name: 'name', Value: fullName }],
  }));
  await client().send(new AdminConfirmSignUpCommand({ UserPoolId: poolId(), Username: email }));
  await addToGroup(email, 'PASSENGER');
}

async function signIn(email, password) {
  const { InitiateAuthCommand } = sdk();
  const res = await client().send(new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH', ClientId: clientId(),
    AuthParameters: { USERNAME: email, PASSWORD: password },
  }));
  if (!res.AuthenticationResult) throw Object.assign(new Error('Additional sign-in step required'), { status: 401 });
  return res.AuthenticationResult.IdToken;
}

// Admin-created STAFF / ADMIN accounts. Returns the new user's Cognito sub.
async function adminCreateUser({ email, password, fullName, role }) {
  const { AdminCreateUserCommand, AdminSetUserPasswordCommand } = sdk();
  const created = await client().send(new AdminCreateUserCommand({
    UserPoolId: poolId(), Username: email, MessageAction: 'SUPPRESS',
    UserAttributes: [
      { Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }, { Name: 'name', Value: fullName },
    ],
  }));
  await client().send(new AdminSetUserPasswordCommand({ UserPoolId: poolId(), Username: email, Password: password, Permanent: true }));
  await addToGroup(email, role);
  return created.User.Attributes.find((a) => a.Name === 'sub').Value;
}

// Translate Cognito SDK errors into clean HTTP errors.
function toHttpError(e) {
  const map = {
    UsernameExistsException: [409, 'An account with this email already exists'],
    InvalidPasswordException: [400, 'Password does not meet the policy (8+ chars, upper-case, number)'],
    NotAuthorizedException: [401, 'Invalid email or password'],
    UserNotFoundException: [401, 'Invalid email or password'],
    UserNotConfirmedException: [401, 'Account not confirmed'],
    InvalidParameterException: [400, 'Invalid input'],
  };
  const hit = map[e.name];
  if (!hit) return e;
  return Object.assign(new Error(hit[1]), { status: hit[0] });
}

module.exports = { roleFromGroups, verifyIdToken, signUpPassenger, signIn, adminCreateUser, toHttpError };
