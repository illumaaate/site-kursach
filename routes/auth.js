const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

const buildSafeUser = (userDoc) => {
  const { _id, name, email, createdAt, updatedAt } = userDoc;
  return { _id, name, email, createdAt, updatedAt };
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Заполните все поля' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Такой email уже зарегистрирован' });
    }

    const user = new User({ name, email, password });
    await user.save();

    const token = createToken(user._id);
    res.status(201).json({ token, user: buildSafeUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Введите email и пароль' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );
    if (!user) {
      return res.status(401).json({ error: 'Неверные данные' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ error: 'Неверные данные' });
    }

    const token = createToken(user._id);
    res.json({ token, user: buildSafeUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
    if (!token) {
      return res.status(401).json({ error: 'Нет токена' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json({ user: buildSafeUser(user) });
  } catch (err) {
    res.status(401).json({ error: 'Сессия истекла' });
  }
});

module.exports = router;

