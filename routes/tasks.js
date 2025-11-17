// routes/tasks.js
const express = require('express');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const router = express.Router();

router.use(auth);

// GET /api/tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.userId,
    });
    if (!task) return res.status(404).json({ error: 'Not found' });
    res.json(task);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const payload = (({ title, description, dueDate, status, category }) => ({
      title,
      description,
      dueDate,
      status,
      category,
    }))(req.body);
    const task = new Task({ ...payload, user: req.userId });
    await task.save();
    res.status(201).json(task);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// PUT /api/tasks/:id
router.put('/:id', async (req, res) => {
  try {
    const allowedFields = [
      'title',
      'description',
      'dueDate',
      'status',
      'category',
    ];
    const updateData = {};
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updateData[field] = req.body[field];
      }
    });

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      updateData,
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ error: 'Not found' });
    res.json(task);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });
    if (!task) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
