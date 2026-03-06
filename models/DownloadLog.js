const mongoose = require('mongoose');

const downloadLogSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  type: { type: String, required: true },      // CSV | JSON | PDF
  dataset: { type: String, required: true },    // registrations | contacts | credentials | analytics
  filename: { type: String, required: true },
  ip: { type: String, default: 'unknown' }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = mongoose.model('DownloadLog', downloadLogSchema);
