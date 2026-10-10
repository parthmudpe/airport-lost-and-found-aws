const db = require('./index');
const { newId, nowIso, reportNumber } = require('../utils/idGen');

// ------------------------------------------------------------------
// Central repository: every route handler goes through these functions
// instead of writing raw SQL inline. This is the seam to swap SQLite
// for DynamoDB later (see docs/database.md).
// ------------------------------------------------------------------

function parseJsonSafe(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

// ---------------- Airports ----------------
const Airports = {
  create({ code, name, city, country, terminals }) {
    const id = newId();
    const ts = nowIso();
    db.prepare(`INSERT INTO airports (id, code, name, city, country, terminals, created_at, updated_at)
      VALUES (@id, @code, @name, @city, @country, @terminals, @ts, @ts)`)
      .run({ id, code, name, city, country, terminals: JSON.stringify(terminals || []), ts });
    return Airports.getById(id);
  },
  getById(id) {
    const row = db.prepare('SELECT * FROM airports WHERE id = ?').get(id);
    return row ? { ...row, terminals: parseJsonSafe(row.terminals, []) } : null;
  },
  list() {
    return db.prepare('SELECT * FROM airports ORDER BY name').all()
      .map(r => ({ ...r, terminals: parseJsonSafe(r.terminals, []) }));
  },
};

// ---------------- Users ----------------
const Users = {
  create({ id: givenId, email, passwordHash, fullName, phone, role, airportId }) {
    const id = givenId || newId();
    const ts = nowIso();
    db.prepare(`INSERT INTO users (id, email, password_hash, full_name, phone, role, airport_id, is_active, created_at, updated_at)
      VALUES (@id, @email, @passwordHash, @fullName, @phone, @role, @airportId, 1, @ts, @ts)`)
      .run({
        id,
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        phone: phone || null,
        role,
        airportId: airportId || null,
        ts,
      });
    return Users.getById(id);
  },
  getById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
  },
  getByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) || null;
  },
  list({ role } = {}) {
    if (role) return db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC').all(role);
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  },
  setRole(id, role) {
    db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, nowIso(), id);
    return Users.getById(id);
  },
  setActive(id, isActive) {
    db.prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?').run(isActive ? 1 : 0, nowIso(), id);
    return Users.getById(id);
  },
  count() {
    return db.prepare('SELECT COUNT(*) c FROM users').get().c;
  },
};

// ---------------- Lost Items ----------------
function serializeLostItem(row) {
  if (!row) return null;
  return { ...row, images: parseJsonSafe(row.images, []) };
}

const LostItems = {
  create(data) {
    const id = newId();
    const ts = nowIso();
    const seq = db.prepare('SELECT COUNT(*) c FROM lost_items').get().c + 1;
    const report_number = reportNumber('LF', seq);

    db.prepare(`INSERT INTO lost_items (
        id, report_number, user_id, category, item_name, description, brand, model, color,
        serial_number, unique_features, date_lost, time_lost, airport_id, terminal, location_area,
        flight_number, contact_phone, contact_email, images, additional_notes, status, created_at, updated_at
      ) VALUES (
        @id, @report_number, @user_id, @category, @item_name, @description, @brand, @model, @color,
        @serial_number, @unique_features, @date_lost, @time_lost, @airport_id, @terminal, @location_area,
        @flight_number, @contact_phone, @contact_email, @images, @additional_notes, 'REPORTED', @ts, @ts
      )`).run({
        id,
        report_number,
        user_id: data.userId,
        category: data.category,
        item_name: data.itemName,
        description: data.description || null,
        brand: data.brand || null,
        model: data.model || null,
        color: data.color || null,
        serial_number: data.serialNumber || null,
        unique_features: data.uniqueFeatures || null,
        date_lost: data.dateLost,
        time_lost: data.timeLost || null,
        airport_id: data.airportId,
        terminal: data.terminal || null,
        location_area: data.locationArea || null,
        flight_number: data.flightNumber || null,
        contact_phone: data.contactPhone || null,
        contact_email: data.contactEmail || null,
        images: JSON.stringify(data.images || []),
        additional_notes: data.additionalNotes || null,
        ts,
      });

    return LostItems.getById(id);
  },

  getById(id) {
    return serializeLostItem(db.prepare('SELECT * FROM lost_items WHERE id = ?').get(id));
  },

  listByUser(userId) {
    return db.prepare('SELECT * FROM lost_items WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId)
      .map(serializeLostItem);
  },

  search({
    category,
    brand,
    model,
    color,
    airportId,
    terminal,
    status,
    dateFrom,
    dateTo,
    q,
    page = 1,
    pageSize = 20,
  }) {
    const clauses = [];
    const params = {};

    if (category) {
      clauses.push('category = @category');
      params.category = category;
    }
    if (brand) {
      clauses.push('brand LIKE @brand');
      params.brand = `%${brand}%`;
    }
    if (model) {
      clauses.push('model LIKE @model');
      params.model = `%${model}%`;
    }
    if (color) {
      clauses.push('color LIKE @color');
      params.color = `%${color}%`;
    }
    if (airportId) {
      clauses.push('airport_id = @airportId');
      params.airportId = airportId;
    }
    if (terminal) {
      clauses.push('terminal = @terminal');
      params.terminal = terminal;
    }
    if (status) {
      clauses.push('status = @status');
      params.status = status;
    }
    if (dateFrom) {
      clauses.push('date_lost >= @dateFrom');
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      clauses.push('date_lost <= @dateTo');
      params.dateTo = dateTo;
    }
    if (q) {
      clauses.push('(item_name LIKE @q OR description LIKE @q OR report_number LIKE @q)');
      params.q = `%${q}%`;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) c FROM lost_items ${where}`).get(params).c;
    const offset = (page - 1) * pageSize;

    const rows = db.prepare(
      `SELECT * FROM lost_items ${where}
       ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit: pageSize, offset });

    return { items: rows.map(serializeLostItem), total, page, pageSize };
  },

  // FIXED: Convert frontend camelCase fields into database snake_case columns.
  update(id, patch) {
    const existing = LostItems.getById(id);
    if (!existing) return null;

    const merged = {
      ...existing,
      category: patch.category ?? existing.category,
      item_name: patch.itemName ?? existing.item_name,
      description: patch.description ?? existing.description,
      brand: patch.brand ?? existing.brand,
      model: patch.model ?? existing.model,
      color: patch.color ?? existing.color,
      serial_number: patch.serialNumber ?? existing.serial_number,
      unique_features: patch.uniqueFeatures ?? existing.unique_features,
      date_lost: patch.dateLost ?? existing.date_lost,
      time_lost: patch.timeLost ?? existing.time_lost,
      terminal: patch.terminal ?? existing.terminal,
      location_area: patch.locationArea ?? existing.location_area,
      flight_number: patch.flightNumber ?? existing.flight_number,
      contact_phone: patch.contactPhone ?? existing.contact_phone,
      contact_email: patch.contactEmail ?? existing.contact_email,
      images: JSON.stringify(patch.images ?? existing.images),
      additional_notes: patch.additionalNotes ?? existing.additional_notes,
      status: patch.status ?? existing.status,
    };

    const ts = nowIso();

    db.prepare(`UPDATE lost_items SET
        category=@category,
        item_name=@item_name,
        description=@description,
        brand=@brand,
        model=@model,
        color=@color,
        serial_number=@serial_number,
        unique_features=@unique_features,
        date_lost=@date_lost,
        time_lost=@time_lost,
        terminal=@terminal,
        location_area=@location_area,
        flight_number=@flight_number,
        contact_phone=@contact_phone,
        contact_email=@contact_email,
        images=@images,
        additional_notes=@additional_notes,
        status=@status,
        updated_at=@ts
      WHERE id=@id`).run({ ...merged, id, ts });

    return LostItems.getById(id);
  },

  setStatus(id, status) {
    db.prepare('UPDATE lost_items SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, nowIso(), id);
    return LostItems.getById(id);
  },

  delete(id) {
    db.prepare('DELETE FROM lost_items WHERE id = ?').run(id);
  },

  countByStatus() {
    return db.prepare('SELECT status, COUNT(*) c FROM lost_items GROUP BY status').all();
  },

  count() {
    return db.prepare('SELECT COUNT(*) c FROM lost_items').get().c;
  },
};

// ---------------- Found Items ----------------
function serializeFoundItem(row) {
  if (!row) return null;
  return { ...row, images: parseJsonSafe(row.images, []) };
}

const FoundItems = {
  create(data) {
    const id = newId();
    const ts = nowIso();
    const seq = db.prepare('SELECT COUNT(*) c FROM found_items').get().c + 1;
    const found_number = reportNumber('FD', seq);

    db.prepare(`INSERT INTO found_items (
        id, found_number, category, item_name, description, brand, model, color, serial_number,
        unique_features, date_found, time_found, airport_id, terminal, location_area, found_by_staff_id,
        storage_location, images, status, created_at, updated_at
      ) VALUES (
        @id, @found_number, @category, @item_name, @description, @brand, @model, @color, @serial_number,
        @unique_features, @date_found, @time_found, @airport_id, @terminal, @location_area, @found_by_staff_id,
        @storage_location, @images, 'FOUND', @ts, @ts
      )`).run({
        id,
        found_number,
        category: data.category,
        item_name: data.itemName,
        description: data.description || null,
        brand: data.brand || null,
        model: data.model || null,
        color: data.color || null,
        serial_number: data.serialNumber || null,
        unique_features: data.uniqueFeatures || null,
        date_found: data.dateFound,
        time_found: data.timeFound || null,
        airport_id: data.airportId,
        terminal: data.terminal || null,
        location_area: data.locationArea || null,
        found_by_staff_id: data.foundByStaffId,
        storage_location: data.storageLocation || null,
        images: JSON.stringify(data.images || []),
        ts,
      });

    return FoundItems.getById(id);
  },

  getById(id) {
    return serializeFoundItem(db.prepare('SELECT * FROM found_items WHERE id = ?').get(id));
  },

  search({
    category,
    brand,
    model,
    color,
    airportId,
    terminal,
    status,
    q,
    page = 1,
    pageSize = 20,
  }) {
    const clauses = [];
    const params = {};

    if (category) {
      clauses.push('category = @category');
      params.category = category;
    }
    if (brand) {
      clauses.push('brand LIKE @brand');
      params.brand = `%${brand}%`;
    }
    if (model) {
      clauses.push('model LIKE @model');
      params.model = `%${model}%`;
    }
    if (color) {
      clauses.push('color LIKE @color');
      params.color = `%${color}%`;
    }
    if (airportId) {
      clauses.push('airport_id = @airportId');
      params.airportId = airportId;
    }
    if (terminal) {
      clauses.push('terminal = @terminal');
      params.terminal = terminal;
    }
    if (status) {
      clauses.push('status = @status');
      params.status = status;
    }
    if (q) {
      clauses.push('(item_name LIKE @q OR description LIKE @q OR found_number LIKE @q)');
      params.q = `%${q}%`;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) c FROM found_items ${where}`).get(params).c;
    const offset = (page - 1) * pageSize;

    const rows = db.prepare(
      `SELECT * FROM found_items ${where}
       ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit: pageSize, offset });

    return { items: rows.map(serializeFoundItem), total, page, pageSize };
  },

  listAll() {
    return db.prepare('SELECT * FROM found_items ORDER BY created_at DESC')
      .all()
      .map(serializeFoundItem);
  },

  setStatus(id, status) {
    db.prepare('UPDATE found_items SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, nowIso(), id);
    return FoundItems.getById(id);
  },

  // FIXED: Convert frontend camelCase fields into database snake_case columns.
  update(id, patch) {
    const existing = FoundItems.getById(id);
    if (!existing) return null;

    const merged = {
      ...existing,
      category: patch.category ?? existing.category,
      item_name: patch.itemName ?? existing.item_name,
      description: patch.description ?? existing.description,
      brand: patch.brand ?? existing.brand,
      model: patch.model ?? existing.model,
      color: patch.color ?? existing.color,
      serial_number: patch.serialNumber ?? existing.serial_number,
      unique_features: patch.uniqueFeatures ?? existing.unique_features,
      date_found: patch.dateFound ?? existing.date_found,
      time_found: patch.timeFound ?? existing.time_found,
      terminal: patch.terminal ?? existing.terminal,
      location_area: patch.locationArea ?? existing.location_area,
      storage_location: patch.storageLocation ?? existing.storage_location,
      images: JSON.stringify(patch.images ?? existing.images),
      status: patch.status ?? existing.status,
    };

    const ts = nowIso();

    db.prepare(`UPDATE found_items SET
        category=@category,
        item_name=@item_name,
        description=@description,
        brand=@brand,
        model=@model,
        color=@color,
        serial_number=@serial_number,
        unique_features=@unique_features,
        date_found=@date_found,
        time_found=@time_found,
        terminal=@terminal,
        location_area=@location_area,
        storage_location=@storage_location,
        images=@images,
        status=@status,
        updated_at=@ts
      WHERE id=@id`).run({ ...merged, id, ts });

    return FoundItems.getById(id);
  },

  countByStatus() {
    return db.prepare('SELECT status, COUNT(*) c FROM found_items GROUP BY status').all();
  },

  count() {
    return db.prepare('SELECT COUNT(*) c FROM found_items').get().c;
  },
};

// ---------------- Matches ----------------
function serializeMatch(row) {
  if (!row) return null;
  return {
    ...row,
    reasons: parseJsonSafe(row.reasons, []),
    differences: parseJsonSafe(row.differences, []),
  };
}

const Matches = {
  create({ lostItemId, foundItemId, score, confidence, reasons, differences }) {
    const id = newId();
    const ts = nowIso();

    db.prepare(`INSERT INTO matches (
        id, lost_item_id, found_item_id, score, confidence, reasons, differences,
        status, created_at, updated_at
      ) VALUES (
        @id, @lostItemId, @foundItemId, @score, @confidence, @reasons, @differences,
        'PENDING_REVIEW', @ts, @ts
      )`).run({
        id,
        lostItemId,
        foundItemId,
        score,
        confidence,
        reasons: JSON.stringify(reasons || []),
        differences: JSON.stringify(differences || []),
        ts,
      });

    return Matches.getById(id);
  },

  getById(id) {
    return serializeMatch(db.prepare('SELECT * FROM matches WHERE id = ?').get(id));
  },

  existsFor(lostItemId, foundItemId) {
    return !!db.prepare(
      'SELECT id FROM matches WHERE lost_item_id = ? AND found_item_id = ?'
    ).get(lostItemId, foundItemId);
  },

  listForLostItem(lostItemId) {
    return db.prepare('SELECT * FROM matches WHERE lost_item_id = ? ORDER BY score DESC')
      .all(lostItemId)
      .map(serializeMatch);
  },

  listForFoundItem(foundItemId) {
    return db.prepare('SELECT * FROM matches WHERE found_item_id = ? ORDER BY score DESC')
      .all(foundItemId)
      .map(serializeMatch);
  },

  list({ status, page = 1, pageSize = 20 } = {}) {
    const clauses = [];
    const params = {};

    if (status) {
      clauses.push('status = @status');
      params.status = status;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) c FROM matches ${where}`).get(params).c;
    const offset = (page - 1) * pageSize;

    const rows = db.prepare(
      `SELECT * FROM matches ${where}
       ORDER BY score DESC LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit: pageSize, offset });

    return { items: rows.map(serializeMatch), total, page, pageSize };
  },

  updateStatus(id, status, reviewedByStaffId) {
    db.prepare(
      'UPDATE matches SET status = ?, reviewed_by_staff_id = COALESCE(?, reviewed_by_staff_id), updated_at = ? WHERE id = ?'
    ).run(status, reviewedByStaffId || null, nowIso(), id);

    return Matches.getById(id);
  },

  countByStatus() {
    return db.prepare('SELECT status, COUNT(*) c FROM matches GROUP BY status').all();
  },
};

// ---------------- Ownership Verifications ----------------
function serializeOwnership(row) {
  if (!row) return null;
  return {
    ...row,
    proof_documents: parseJsonSafe(row.proof_documents, []),
  };
}

const OwnershipVerifications = {
  create({ matchId, lostItemId, passengerId, verificationMethod }) {
    const id = newId();
    const ts = nowIso();

    db.prepare(`INSERT INTO ownership_verifications (
        id, match_id, lost_item_id, passenger_id, verification_method, status, created_at, updated_at
      ) VALUES (
        @id, @matchId, @lostItemId, @passengerId, @verificationMethod, 'REQUESTED', @ts, @ts
      )`).run({
        id,
        matchId,
        lostItemId,
        passengerId,
        verificationMethod: verificationMethod || null,
        ts,
      });

    return OwnershipVerifications.getById(id);
  },

  getById(id) {
    return serializeOwnership(db.prepare(
      'SELECT * FROM ownership_verifications WHERE id = ?'
    ).get(id));
  },

  listForMatch(matchId) {
    return db.prepare(
      'SELECT * FROM ownership_verifications WHERE match_id = ? ORDER BY created_at DESC'
    ).all(matchId).map(serializeOwnership);
  },

  submitProof(id, { proofText, proofDocuments }) {
    db.prepare(`UPDATE ownership_verifications
      SET proof_text = ?, proof_documents = ?, status = 'SUBMITTED', updated_at = ?
      WHERE id = ?`)
      .run(proofText || null, JSON.stringify(proofDocuments || []), nowIso(), id);

    return OwnershipVerifications.getById(id);
  },

  review(id, { approved, staffId, notes }) {
    db.prepare(`UPDATE ownership_verifications
      SET status = ?, reviewed_by_staff_id = ?, staff_notes = ?, updated_at = ?
      WHERE id = ?`)
      .run(
        approved ? 'STAFF_APPROVED' : 'STAFF_REJECTED',
        staffId,
        notes || null,
        nowIso(),
        id
      );

    return OwnershipVerifications.getById(id);
  },
};

// ---------------- Notifications ----------------
const Notifications = {
  create({
    userId,
    type,
    title,
    message,
    relatedEntityType,
    relatedEntityId,
    channel,
  }) {
    const id = newId();
    const ts = nowIso();

    db.prepare(`INSERT INTO notifications (
        id, user_id, type, title, message, related_entity_type, related_entity_id,
        is_read, channel, created_at
      ) VALUES (
        @id, @userId, @type, @title, @message, @relatedEntityType, @relatedEntityId,
        0, @channel, @ts
      )`).run({
        id,
        userId,
        type,
        title,
        message,
        relatedEntityType: relatedEntityType || null,
        relatedEntityId: relatedEntityId || null,
        channel: channel || 'INAPP',
        ts,
      });

    return Notifications.getById(id);
  },

  getById(id) {
    return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) || null;
  },

  listForUser(userId, { unreadOnly = false } = {}) {
    if (unreadOnly) {
      return db.prepare(
        'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC'
      ).all(userId);
    }

    return db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId);
  },

  markRead(id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    return Notifications.getById(id);
  },
};

// ---------------- Audit Logs ----------------
const AuditLogs = {
  record({ userId, role, action, entityType, entityId, metadata }) {
    const id = newId();
    const ts = nowIso();

    db.prepare(`INSERT INTO audit_logs (
        id, user_id, role, action, entity_type, entity_id, metadata, created_at
      ) VALUES (
        @id, @userId, @role, @action, @entityType, @entityId, @metadata, @ts
      )`).run({
        id,
        userId: userId || null,
        role: role || null,
        action,
        entityType,
        entityId: entityId || null,
        metadata: JSON.stringify(metadata || {}),
        ts,
      });

    return id;
  },

  list({ page = 1, pageSize = 50, entityType, userId } = {}) {
    const clauses = [];
    const params = {};

    if (entityType) {
      clauses.push('entity_type = @entityType');
      params.entityType = entityType;
    }
    if (userId) {
      clauses.push('user_id = @userId');
      params.userId = userId;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) c FROM audit_logs ${where}`).get(params).c;
    const offset = (page - 1) * pageSize;

    const rows = db.prepare(
      `SELECT * FROM audit_logs ${where}
       ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit: pageSize, offset });

    return {
      items: rows.map(r => ({
        ...r,
        metadata: parseJsonSafe(r.metadata, {}),
      })),
      total,
      page,
      pageSize,
    };
  },
};

module.exports = {
  Airports,
  Users,
  LostItems,
  FoundItems,
  Matches,
  OwnershipVerifications,
  Notifications,
  AuditLogs,
};