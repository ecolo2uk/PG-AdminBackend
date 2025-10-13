import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// Get all admin users (admin, super admin, Editor, Viewer)
export const getAdminUsers = async (req, res) => { // Changed here
  try {
    const users = await User.find({
      role: { $in: [ "admin"]  }
    }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create admin user
export const createAdminUser = async (req, res) => { // Changed here
  try {
    const { firstname, lastname, email, password, role, company } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = await User.create({
      firstname,
      lastname,
      email,
      password: hashedPassword,
      role,
      company
    });

    res.status(201).json({ message: 'Admin user created successfully', user: newUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update admin user
export const updateAdminUser = async (req, res) => { // Changed here
  try {
    const { firstname, lastname, email, role, status, company } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { firstname, lastname, email, role, status, company },
      { new: true }
    );

    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete admin user
export const deleteAdminUser = async (req, res) => { // Changed here
  try {
    const user = await User.findById(req.params.id);

    if (user.role === 'super admin') {
      return res.status(400).json({ message: 'Cannot delete super admin' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};