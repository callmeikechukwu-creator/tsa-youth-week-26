/* ============================================================
   lib/analytics.js
   Google Analytics 4 Data API — server-side helper
   ============================================================ */

'use strict';

let _client = null;
let _propertyId = null;
let _ready = false;
let _initError = null;

function init() {
  if (_ready || _initError) return;

  _propertyId = process.env.GA_PROPERTY_ID;
  if (!_propertyId) {
    _initError = 'GA_PROPERTY_ID not set';
    return;
  }

  let credentials = null;

  // Option A: JSON string in env (recommended for hosted deployments)
  if (process.env.GA_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = JSON.parse(process.env.GA_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      _initError = 'GA_SERVICE_ACCOUNT_JSON is not valid JSON';
      return;
    }
  }
  // Option B: Base64-encoded JSON in env
  else if (process.env.GA_SERVICE_ACCOUNT_B64) {
    try {
      credentials = JSON.parse(
        Buffer.from(process.env.GA_SERVICE_ACCOUNT_B64, 'base64').toString('utf8')
      );
    } catch (e) {
      _initError = 'GA_SERVICE_ACCOUNT_B64 could not be decoded';
      return;
    }
  }
  // Option C: File path via GOOGLE_APPLICATION_CREDENTIALS (local dev default)
  // The SDK picks this up automatically — no explicit credentials needed

  try {
    const { BetaAnalyticsDataClient } = require('@google-analytics/data');
    _client = credentials
      ? new BetaAnalyticsDataClient({ credentials })
      : new BetaAnalyticsDataClient(); // uses GOOGLE_APPLICATION_CREDENTIALS
    _ready = true;
  } catch (e) {
    _initError = '@google-analytics/data not installed. Run: npm install @google-analytics/data';
  }
}

// ── Helper: run a GA4 report ──
async function runReport(dimensions, metrics, dateRanges, opts = {}) {
  init();
  if (!_ready) throw new Error(_initError || 'Analytics not initialised');

  const [response] = await _client.runReport({
    property: `properties/${_propertyId}`,
    dimensions,
    metrics,
    dateRanges,
    ...opts,
  });
  return response;
}

// ── Helper: run a GA4 realtime report ──
async function runRealtimeReport(dimensions, metrics) {
  init();
  if (!_ready) throw new Error(_initError || 'Analytics not initialised');

  const [response] = await _client.runRealtimeReport({
    property: `properties/${_propertyId}`,
    dimensions,
    metrics,
  });
  return response;
}

// ── Parse row helpers ──
function rowVal(row, idx) {
  return row.dimensionValues?.[idx]?.value ?? '';
}
function rowMetric(row, idx = 0) {
  return parseInt(row.metricValues?.[idx]?.value ?? '0', 10);
}

/* ============================================================
   PUBLIC API
   ============================================================ */

/**
 * Key metrics for the last 30 days
 * Returns: { sessions, users, pageviews, bounceRate, avgSessionDuration }
 */
async function getOverview() {
  const report = await runReport(
    [],
    [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
    [{ startDate: '30daysAgo', endDate: 'today' }]
  );

  const row = report.rows?.[0];
  if (!row) return { sessions: 0, users: 0, pageviews: 0, bounceRate: 0, avgDuration: 0 };

  return {
    sessions:    parseInt(row.metricValues[0].value, 10),
    users:       parseInt(row.metricValues[1].value, 10),
    pageviews:   parseInt(row.metricValues[2].value, 10),
    bounceRate:  Math.round(parseFloat(row.metricValues[3].value) * 100),
    avgDuration: Math.round(parseFloat(row.metricValues[4].value)),
  };
}

/**
 * Daily sessions for the last N days (for sparkline/bar chart)
 * Returns: [ { date: 'YYYYMMDD', sessions, users }, ... ] sorted oldest→newest
 */
async function getDailyTrend(days = 14) {
  const report = await runReport(
    [{ name: 'date' }],
    [{ name: 'sessions' }, { name: 'totalUsers' }],
    [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    { orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }] }
  );

  return (report.rows || []).map(row => ({
    date:     rowVal(row, 0),
    sessions: rowMetric(row, 0),
    users:    rowMetric(row, 1),
  }));
}

/**
 * Top pages by page views (last 30 days)
 * Returns: [ { path, title, views }, ... ]
 */
async function getTopPages(limit = 8) {
  const report = await runReport(
    [{ name: 'pagePath' }, { name: 'pageTitle' }],
    [{ name: 'screenPageViews' }, { name: 'totalUsers' }],
    [{ startDate: '30daysAgo', endDate: 'today' }],
    {
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit,
    }
  );

  return (report.rows || []).map(row => ({
    path:   rowVal(row, 0),
    title:  rowVal(row, 1),
    views:  rowMetric(row, 0),
    users:  rowMetric(row, 1),
  }));
}

/**
 * Traffic sources / channels (last 30 days)
 * Returns: [ { channel, sessions }, ... ]
 */
async function getTrafficSources(limit = 6) {
  const report = await runReport(
    [{ name: 'sessionDefaultChannelGroup' }],
    [{ name: 'sessions' }],
    [{ startDate: '30daysAgo', endDate: 'today' }],
    {
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit,
    }
  );

  return (report.rows || []).map(row => ({
    channel:  rowVal(row, 0),
    sessions: rowMetric(row, 0),
  }));
}

/**
 * Device category split (last 30 days)
 * Returns: [ { device, sessions, pct }, ... ]
 */
async function getDeviceSplit() {
  const report = await runReport(
    [{ name: 'deviceCategory' }],
    [{ name: 'sessions' }],
    [{ startDate: '30daysAgo', endDate: 'today' }],
    { orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] }
  );

  const rows = (report.rows || []).map(row => ({
    device:   rowVal(row, 0),
    sessions: rowMetric(row, 0),
  }));
  const total = rows.reduce((s, r) => s + r.sessions, 0) || 1;
  return rows.map(r => ({ ...r, pct: Math.round((r.sessions / total) * 100) }));
}

/**
 * Top countries (last 30 days)
 * Returns: [ { country, sessions }, ... ]
 */
async function getTopCountries(limit = 6) {
  const report = await runReport(
    [{ name: 'country' }],
    [{ name: 'sessions' }],
    [{ startDate: '30daysAgo', endDate: 'today' }],
    {
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit,
    }
  );

  return (report.rows || []).map(row => ({
    country:  rowVal(row, 0),
    sessions: rowMetric(row, 0),
  }));
}

/**
 * Active users right now (realtime)
 * Returns: number
 */
async function getRealtimeUsers() {
  const report = await runRealtimeReport(
    [],
    [{ name: 'activeUsers' }]
  );
  return parseInt(report.rows?.[0]?.metricValues?.[0]?.value ?? '0', 10);
}

/**
 * Fetch all overview + chart data in parallel (for the main dashboard call)
 */
async function getDashboardData() {
  const [overview, trend, pages, sources, devices, countries] = await Promise.all([
    getOverview(),
    getDailyTrend(14),
    getTopPages(8),
    getTrafficSources(6),
    getDeviceSplit(),
    getTopCountries(6),
  ]);
  return { overview, trend, pages, sources, devices, countries };
}

module.exports = {
  isConfigured: () => { init(); return _ready; },
  initError:    () => { init(); return _initError; },
  getDashboardData,
  getRealtimeUsers,
};
