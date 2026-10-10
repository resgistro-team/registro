const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const store = require('../data/store');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Register new user
router.post('/register', (req, res) => {
  const { name, email, password, role, bio } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const existing = store.getUserByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const newUser = {
    id: `usr_${uuidv4().substring(0, 8)}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: hashedPassword,
    avatar: `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name)}`,
    role: role || 'attendee',
    bio: bio || 'Registro community member',
    createdAt: new Date().toISOString()
  };

  store.createUser(newUser);

  const { password: _, ...userWithoutPass } = newUser;
  const token = generateToken(newUser);

  res.status(201).json({
    message: 'Account created successfully',
    user: userWithoutPass,
    token
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = store.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const { password: _, ...userWithoutPass } = user;
  const token = generateToken(user);

  res.json({
    message: 'Signed in successfully',
    user: userWithoutPass,
    token
  });
});

// Get current user profile
router.get('/me', authMiddleware, (req, res) => {
  const { password: _, ...userWithoutPass } = req.user;
  const registrations = store.getRegistrationsByUserId(req.user.id);
  const organizedEvents = store.getEvents().filter(e => e.organizerId === req.user.id);

  res.json({
    user: userWithoutPass,
    stats: {
      registeredCount: registrations.length,
      organizedCount: organizedEvents.length
    }
  });
});

// Update profile
router.put('/me', authMiddleware, (req, res) => {
  const { name, bio, avatar, role } = req.body;
  const updates = {};
  if (name) updates.name = name.trim();
  if (bio !== undefined) updates.bio = bio.trim();
  if (avatar) updates.avatar = avatar;
  if (role) updates.role = role;

  const updated = store.updateUser(req.user.id, updates);
  const { password: _, ...userWithoutPass } = updated;
  res.json({ user: userWithoutPass });
});

// Get demo users for 1-click test switching
router.get('/demo-users', (req, res) => {
  const users = store.getUsers().map(u => {
    const { password, ...safe } = u;
    return safe;
  });
  res.json(users);
});

// 1-click login as demo user
router.post('/switch-demo', (req, res) => {
  const { userId } = req.body;
  const user = store.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'Demo user not found.' });
  }

  const { password: _, ...userWithoutPass } = user;
  const token = generateToken(user);

  res.json({
    message: `Switched to ${user.name}`,
    user: userWithoutPass,
    token
  });
});

module.exports = router;
