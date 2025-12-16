const express = require('express');
const router = express.Router();
const { verifyToken, verifyAdmin } = require('../middleware/auth');

// Register/Create User
router.post('/register', async (req, res) => {
  try {
    const { name, email, photoURL } = req.body;
    const db = req.app.locals.db;
    
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(200).json({ message: 'User already exists', user: existingUser });
    }
    
    const newUser = {
      name,
      email,
      photoURL: photoURL || '',
      role: 'member',
      createdAt: new Date()
    };
    
    await db.collection('users').insertOne(newUser);
    res.status(201).json({ message: 'User created successfully', user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Get User Profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const email = req.user.email;
    const db = req.app.locals.db;
    
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user profile', error: error.message });
  }
});

// Get All Users (Admin only)
router.get('/', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const users = await db.collection('users').find({}).toArray();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
});

// Update User Role (Admin only)
router.patch('/role/:email', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { email } = req.params;
    const { role } = req.body;
    const db = req.app.locals.db;
    const adminEmail = req.user.email;
    
    if (email === adminEmail) {
      return res.status(403).json({ message: 'Cannot change your own role' });
    }
    
    if (!['admin', 'clubManager', 'member'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    const result = await db.collection('users').updateOne(
      { email },
      { $set: { role, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ message: 'User role updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user role', error: error.message });
  }
});

// Update User Profile
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const email = req.user.email;
    const { name, photoURL } = req.body;
    const db = req.app.locals.db;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (photoURL) updateData.photoURL = photoURL;
    updateData.updatedAt = new Date();
    
    await db.collection('users').updateOne(
      { email },
      { $set: updateData }
    );
    
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error: error.message });
  }
});

module.exports = router;
