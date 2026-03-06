const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, maxlength: 254, lowercase: true },
  age: { type: String, required: true, maxlength: 30 },
  church: { type: String, maxlength: 200, default: '' },
  role: { type: String, required: true, maxlength: 60 },
  heard: { type: String, maxlength: 60, default: '' }
}, { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } });

module.exports = mongoose.model('Registration', registrationSchema);
