import User from '../models/User.js';
import Merchant from '../models/Merchant.js';
import bcrypt from 'bcryptjs';

// Helper function to generate MID (Merchant ID)
const generateMid = () => {
  return 'M' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};


// Get all merchants (simple list with id and name)
export const getAllMerchants = async (req, res) => {
  try {
    const merchants = await Merchant.find({}).select('_id name');
    res.status(200).json(merchants);
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// Get merchant users (your existing function)
export const getMerchantUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'merchant' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    const usersWithFinancialData = users.map(user => ({
      ...user._doc,
      holdAmount: 1000,
      unsettleBal: 1000,
      todayNetPayin: 0,
      availableBal: 1000,
      payoutBal: Math.random() > 0.5 ? 1500 : 1000,
      payoutMid: Math.random() > 0.5 ? 'PayoutOne/1 L' : 'NA / NA'
    }));
    
    res.json(usersWithFinancialData);
  } catch (error) {
    console.error('Error fetching merchant users:', error);
    res.status(500).json({ message: 'Server error while fetching merchant users.' });
  }
};


export const createMerchantUser = async (req, res) => {
  try {
    const { firstname, lastname, company, email, password, contact } = req.body;

    if (!firstname || !lastname || !email || !password || !contact) {
      return res.status(400).json({ message: 'Please enter all required fields: firstname, lastname, email, password, contact.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const mid = generateMid();

    const user = new User({
      firstname,
      lastname,
      company,
      email,
      password: hashedPassword,
      role: 'merchant',
      contact,
      mid
    });

    const savedUser = await user.save();
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);

  } catch (error) {
    console.error('Error creating merchant user:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A user with this email or MID already exists.' });
    }
    res.status(500).json({ message: 'Server error while creating merchant user.' });
  }
};

// Update merchant user
// Change from exports.updateMerchantUser to export const updateMerchantUser
export const updateMerchantUser = async (req, res) => {
  try {
    const { firstname, lastname, company, email, contact, status, password } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user || user.role !== 'merchant') {
      return res.status(404).json({ message: 'Merchant user not found or is not a merchant.' });
    }

    if (firstname) user.firstname = firstname;
    if (lastname) user.lastname = lastname;
    if (company !== undefined) user.company = company;
    if (contact) user.contact = contact;
    if (status) user.status = status;

    if (email && email !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address for update.' });
      }
      const existingUserWithEmail = await User.findOne({ email });
      if (existingUserWithEmail && existingUserWithEmail._id.toString() !== userId) {
        return res.status(400).json({ message: 'Another user with this email already exists.' });
      }
      user.email = email;
    }

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    res.json(userResponse);

  } catch (error) {
    console.error('Error updating merchant user:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }
    res.status(500).json({ message: 'Server error while updating merchant user.' });
  }
};

// Delete merchant user
// Change from exports.deleteMerchantUser to export const deleteMerchantUser
export const deleteMerchantUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.role !== 'merchant') {
      return res.status(403).json({ message: 'Forbidden: Only merchant users can be deleted via this endpoint.' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Merchant user deleted successfully.' });
  } catch (error) {
    console.error('Error deleting merchant user:', error);
    res.status(500).json({ message: 'Server error while deleting merchant user.' });
  }
};