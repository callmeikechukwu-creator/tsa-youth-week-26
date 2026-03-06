const crypto = require('crypto');
const Registration = require('../models/Registration');
const Contact = require('../models/Contact');
const DownloadLog = require('../models/DownloadLog');

const MODELS = {
  registrations: Registration,
  contacts: Contact,
  'download-log': DownloadLog
};

const ID_PREFIXES = { registrations: 'REG', contacts: 'MSG' };
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateId(name) {
  const prefix = ID_PREFIXES[name] || 'REC';
  const now = new Date();
  const date = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += ID_CHARS[crypto.randomInt(ID_CHARS.length)];
  return prefix + '-' + date + '-' + suffix;
}

function getModel(name) {
  const Model = MODELS[name];
  if (!Model) throw new Error(`Unknown collection: ${name}`);
  return Model;
}

async function readAll(name) {
  const Model = getModel(name);
  const docs = await Model.find().sort({ createdAt: 1 }).lean();
  return docs.map(d => { const { _id, __v, ...rest } = d; return rest; });
}

async function add(name, entry) {
  const Model = getModel(name);
  entry.id = generateId(name);
  entry.createdAt = new Date().toISOString();
  const doc = await Model.create(entry);
  const obj = doc.toObject();
  const { _id, __v, ...rest } = obj;
  return rest;
}

async function findById(name, id) {
  const Model = getModel(name);
  const doc = await Model.findOne({ id }).lean();
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return rest;
}

async function remove(name, id) {
  const Model = getModel(name);
  const doc = await Model.findOneAndDelete({ id }).lean();
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return rest;
}

async function count(name) {
  const Model = getModel(name);
  return Model.countDocuments();
}

async function update(name, id, fields) {
  const Model = getModel(name);
  fields.updatedAt = new Date().toISOString();
  const doc = await Model.findOneAndUpdate({ id }, { $set: fields }, { new: true, lean: true });
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  return rest;
}

/* ── Download log ── */
async function logDownload({ type, dataset, filename, ip }) {
  const logId = 'DL-' + Date.now() + '-' + crypto.randomInt(9999).toString().padStart(4, '0');
  await DownloadLog.create({
    id: logId,
    type,
    dataset,
    filename,
    ip: ip || 'unknown',
    createdAt: new Date().toISOString()
  });
  // Keep last 500 entries only
  const total = await DownloadLog.countDocuments();
  if (total > 500) {
    const oldest = await DownloadLog.find().sort({ createdAt: 1 }).limit(total - 500).select('_id');
    const ids = oldest.map(d => d._id);
    await DownloadLog.deleteMany({ _id: { $in: ids } });
  }
}

module.exports = { readAll, add, update, findById, remove, count, logDownload };
