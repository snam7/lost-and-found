const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  type: { type: String, required: true },           // "lost" or "found"
  description: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  image: { type: String },                          // path to the uploaded image
  user: { type: String, required: true },           // user's display name
  tags: { type: [String], default: [] }             // array of tags
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);
