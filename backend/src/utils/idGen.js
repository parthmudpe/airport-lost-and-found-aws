const { v4: uuidv4 } = require('uuid');

function newId() {
  return uuidv4();
}

// Human-friendly sequential-looking report numbers, e.g. LF-2026-00001
function reportNumber(prefix, sequence) {
  const year = new Date().getFullYear();
  const padded = String(sequence).padStart(5, '0');
  return `${prefix}-${year}-${padded}`;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { newId, reportNumber, nowIso };
