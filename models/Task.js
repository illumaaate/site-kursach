const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: String,
    dueDate: Date,
    status: {
      type: String,
      enum: ['todo', 'in-progress', 'done'],
      default: 'todo',
    },
    category: {
      type: String,
      enum: ['study', 'work', 'practice', 'personal'],
      default: 'study',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Task', taskSchema);
