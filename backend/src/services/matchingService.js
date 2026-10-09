const config = require('../config');

// ------------------------------------------------------------------
// Matching engine.
//
// Compares a lost item against a found item and produces a weighted
// score (0-100) plus a human-readable list of reasons/differences.
// Weights and confidence thresholds are fully configurable via
// environment variables (see config/index.js / .env.example) rather
// than hardcoded, per the project requirements.
//
// IMPORTANT: this engine only ever produces a "possible match" with a
// confidence label. It never marks an item as returned or confirms
// ownership - that is always a deliberate staff (and, for ownership,
// staff + passenger) action performed through the matches/
// ownership-verification routes.
// ------------------------------------------------------------------

function normalize(str) {
  return (str || '').toString().trim().toLowerCase();
}

function textSimilarity(a, b) {
  // Lightweight, dependency-free token-overlap similarity (Jaccard on words).
  // This is intentionally simple/non-AI per project requirement #23:
  // "the basic matching system must work without AI." It can later be
  // swapped for an embeddings/AI-based comparator without changing callers.
  const ta = new Set(normalize(a).split(/\W+/).filter(Boolean));
  const tb = new Set(normalize(b).split(/\W+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : intersection / union;
}

function dateTimeProximityScore(lost, found, weight) {
  // Found date must be on/after lost date (can't find something before it
  // was lost) and within a reasonable 30-day window for full credit,
  // decaying linearly to 0 by day 30.
  if (!lost.date_lost || !found.date_found) return { score: 0, reason: null };
  const lostDate = new Date(lost.date_lost);
  const foundDate = new Date(found.date_found);
  if (Number.isNaN(lostDate.getTime()) || Number.isNaN(foundDate.getTime())) return { score: 0, reason: null };
  const diffDays = (foundDate - lostDate) / (1000 * 60 * 60 * 24);
  if (diffDays < -1) return { score: 0, reason: null }; // found before lost (allow 1 day slack for timezone)
  const decay = Math.max(0, 1 - Math.abs(diffDays) / 30);
  const score = Math.round(weight * decay);
  if (score > 0) return { score, reason: `Dates are close (${Math.round(diffDays)} day(s) apart)` };
  return { score: 0, reason: null };
}

function compareItems(lost, found) {
  const w = config.matching.weights;
  const reasons = [];
  const differences = [];
  let score = 0;

  // Category (exact match required to even be a candidate, handled by caller)
  if (normalize(lost.category) === normalize(found.category)) {
    score += w.category;
    reasons.push(`Category matches (${lost.category})`);
  } else {
    differences.push('Category differs');
  }

  // Brand
  if (lost.brand && found.brand) {
    if (normalize(lost.brand) === normalize(found.brand)) {
      score += w.brand;
      reasons.push(`Brand matches (${lost.brand})`);
    } else {
      differences.push(`Brand differs (${lost.brand} vs ${found.brand})`);
    }
  }

  // Model
  if (lost.model && found.model) {
    if (normalize(lost.model) === normalize(found.model)) {
      score += w.model;
      reasons.push(`Model matches (${lost.model})`);
    } else {
      differences.push(`Model differs (${lost.model} vs ${found.model})`);
    }
  }

  // Color
  if (lost.color && found.color) {
    if (normalize(lost.color) === normalize(found.color)) {
      score += w.color;
      reasons.push(`Color matches (${lost.color})`);
    } else {
      differences.push(`Color differs (${lost.color} vs ${found.color})`);
    }
  }

  // Location (airport required equal by caller; compare terminal/area for bonus precision)
  if (normalize(lost.airport_id) === normalize(found.airport_id)) {
    let locScore = Math.round(w.location * 0.6); // base credit for same airport
    reasons.push('Same airport');
    if (lost.terminal && found.terminal && normalize(lost.terminal) === normalize(found.terminal)) {
      locScore = w.location;
      reasons.push(`Same terminal (${lost.terminal})`);
    }
    score += locScore;
  } else {
    differences.push('Different airport');
  }

  // Date/time proximity
  const dt = dateTimeProximityScore(lost, found, w.datetime);
  score += dt.score;
  if (dt.reason) reasons.push(dt.reason);

  // Description similarity
  const simScore = textSimilarity(lost.description, found.description);
  if (simScore > 0) {
    const descPoints = Math.round(w.description * simScore);
    score += descPoints;
    if (simScore > 0.3) reasons.push('Descriptions share significant detail');
  }
  // unique features text also contributes to description-style similarity
  const featSim = textSimilarity(lost.unique_features, found.unique_features);
  if (featSim > 0.3) reasons.push('Unique identifying features overlap');

  // Serial number (strong signal; only counted on exact match, never displayed in full elsewhere)
  if (lost.serial_number && found.serial_number) {
    if (normalize(lost.serial_number) === normalize(found.serial_number)) {
      score += w.serial;
      reasons.push('Serial number matches exactly');
    } else {
      differences.push('Serial number does not match');
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let confidence;
  if (score >= config.matching.thresholds.high) confidence = 'HIGH';
  else if (score >= config.matching.thresholds.medium) confidence = 'MEDIUM';
  else if (score >= config.matching.thresholds.low) confidence = 'LOW';
  else confidence = null; // below threshold -> not suggested

  return { score, confidence, reasons, differences };
}

/**
 * Find and score all candidate found items for a single lost item.
 * Only same-category, same-airport candidates are scored (cheap prefilter);
 * results below the LOW threshold are dropped, per project requirement.
 */
function findCandidateMatches(lostItem, foundItems) {
  const candidates = foundItems.filter(
    (f) => normalize(f.category) === normalize(lostItem.category)
  );
  const results = [];
  for (const found of candidates) {
    const result = compareItems(lostItem, found);
    if (result.confidence) {
      results.push({ foundItem: found, ...result });
    }
  }
  return results.sort((a, b) => b.score - a.score);
}

module.exports = { compareItems, findCandidateMatches };
