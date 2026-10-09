const config = require('../config');
const { Notifications, Users } = require('../db/repository');

// ------------------------------------------------------------------
// Notification abstraction.
//
// notify() always writes an in-app notification row (so the UI never
// depends on external email deliverability). When
// NOTIFICATION_PROVIDER=ses_sns, it additionally pushes to AWS
// SES/SNS. The AWS SDK calls are written but commented out so the
// project runs with zero AWS credentials by default - flip the env
// var and uncomment once real AWS resources exist.
// ------------------------------------------------------------------

const TEMPLATES = {
  LOST_REPORT_SUBMITTED: (ctx) => ({
    title: 'Lost item report submitted',
    message: `Your report ${ctx.reportNumber} for "${ctx.itemName}" has been received. We'll notify you of any possible matches.`,
  }),
  FOUND_ITEM_REGISTERED: (ctx) => ({
    title: 'Found item registered',
    message: `Found item ${ctx.foundNumber} ("${ctx.itemName}") has been logged at ${ctx.airport}.`,
  }),
  POSSIBLE_MATCH_FOUND: (ctx) => ({
    title: 'Possible match found for your lost item',
    message: `We found a possible match (${ctx.confidence} confidence) for your report ${ctx.reportNumber}. Please review it in your dashboard.`,
  }),
  MATCH_REJECTED: (ctx) => ({
    title: 'Match reviewed - not a match',
    message: `Staff reviewed a possible match for report ${ctx.reportNumber} and determined it was not a match. We'll keep searching.`,
  }),
  OWNERSHIP_VERIFICATION_REQUESTED: (ctx) => ({
    title: 'Ownership verification needed',
    message: `Please provide ownership details for report ${ctx.reportNumber} so staff can confirm the match.`,
  }),
  OWNERSHIP_VERIFIED: (ctx) => ({
    title: 'Ownership verified',
    message: `Your ownership of the item in report ${ctx.reportNumber} has been verified.`,
  }),
  OWNERSHIP_REJECTED: (ctx) => ({
    title: 'Ownership verification unsuccessful',
    message: `Staff could not verify ownership for report ${ctx.reportNumber} with the information provided. You may submit additional proof.`,
  }),
  ITEM_READY_FOR_COLLECTION: (ctx) => ({
    title: 'Item ready for collection',
    message: `Your item for report ${ctx.reportNumber} is verified and ready for collection at ${ctx.airport}.`,
  }),
  ITEM_RETURNED: (ctx) => ({
    title: 'Item returned',
    message: `Your item for report ${ctx.reportNumber} has been marked as returned. Thank you for using Airport Lost & Found.`,
  }),
  REPORT_CLOSED: (ctx) => ({
    title: 'Report closed',
    message: `Report ${ctx.reportNumber} has been closed.`,
  }),
};

// ---------------- AWS SES/SNS provider (production) ----------------
// Uncomment and `npm install @aws-sdk/client-sesv2 @aws-sdk/client-sns`
// to enable real email/SMS delivery.
//
// const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
// const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
// const ses = new SESv2Client({ region: config.storage.s3.region });
// const sns = new SNSClient({ region: config.storage.s3.region });
//
// async function sendEmail(toEmail, subject, body) {
//   await ses.send(new SendEmailCommand({
//     FromEmailAddress: config.notifications.sesFromEmail,
//     Destination: { ToAddresses: [toEmail] },
//     Content: { Simple: { Subject: { Data: subject }, Body: { Text: { Data: body } } } },
//   }));
// }
// async function publishSns(message, subject) {
//   await sns.send(new PublishCommand({ TopicArn: config.notifications.snsTopicArn, Message: message, Subject: subject }));
// }

async function notify(userId, type, ctx = {}) {
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown notification type: ${type}`);
  const { title, message } = template(ctx);

  const record = Notifications.create({
    userId, type, title, message,
    relatedEntityType: ctx.relatedEntityType,
    relatedEntityId: ctx.relatedEntityId,
    channel: 'INAPP',
  });

  if (config.notifications.provider === 'ses_sns') {
    const user = Users.getById(userId);
    if (user) {
      // await sendEmail(user.email, title, message);
      // await publishSns(message, title);
      console.log(`[notify:ses_sns-stub] Would email ${user.email}: ${title}`);
    }
  }

  return record;
}

module.exports = { notify, TEMPLATES };
