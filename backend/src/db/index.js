const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('../config');

// ------------------------------------------------------------------
// Database access layer.
//
// Today this talks to SQLite (DB_PROVIDER=sqlite), which is a practical
// stand-in for Amazon DynamoDB in an academic/local-dev environment.
// Every route/service in this project talks to the small repository
// functions in src/db/repository.js rather than to SQL directly, so
// swapping DB_PROVIDER to "dynamodb" only requires implementing the
// same repository interface against the AWS SDK (see docs/database.md
// for the DynamoDB single-table design and access patterns this schema
// mirrors).
// ------------------------------------------------------------------

if (config.db.provider !== 'sqlite') {
  console.warn(
    `[db] DB_PROVIDER="${config.db.provider}" requested, but only the "sqlite" ` +
    'provider is implemented in this codebase. Falling back to sqlite. ' +
    'See docs/database.md for the DynamoDB migration plan.'
  );
}

const dbFile = config.db.sqliteFile;
const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

module.exports = db;
