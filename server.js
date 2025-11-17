// server.js
require('dotenv').config();
const express = require('express');
const compression = require('compression');
const mongoose = require('mongoose');
const cors = require('cors');
const tasksRouter = require('./routes/tasks');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/task_manager';

if (!process.env.JWT_SECRET) {
  console.warn(
    'JWT_SECRET не задан в .env. Используется небезопасное значение по умолчанию.'
  );
  process.env.JWT_SECRET = 'dev-secret';
}

// middleware
app.use(compression()); // gzip/brotli when available — improves mobile payloads
app.use(cors());              // CORS
app.use(express.json());      // JSON body
app.use(express.static('public')); // фронт

// REST API
app.use('/api/auth', authRouter);
app.use('/api/tasks', tasksRouter);

// error handler (простая отказоустойчивость)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
  })
  .catch((e) => console.error(e));
