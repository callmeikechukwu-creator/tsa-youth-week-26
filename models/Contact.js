const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, maxlength: 254, lowercase: true },
  phone: { type: String, maxlength: 30, default: '' },
  subject: { type: String, maxlength: 60, default: '' },
  message: { type: String, required: true, maxlength: 2000 }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = mongoose.model('Contact', contactSchema);
