import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// Helper function to generate MID (Merchant ID)
const generateMid = () => {
  return 'M' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
};

// Get all merchants (simple list with id and name)
export const getAllMerchants = async (req, res) => {
  try {
    const merchants = await User.find({ role: 'merchant' }).select('_id firstname lastname company email');
    
    const formattedMerchants = merchants.map(merchant => ({
      _id: merchant._id,
      name: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
      email: merchant.email
    }));
    
    res.status(200).json({
      success: true,
      data: formattedMerchants
    });
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server Error', 
      error: error.message 
    });
  }
};

// Get merchant users
export const getMerchantUsers = async (req, res) => {
  try {
    console.log("🔍 Fetching merchant users...");
    
    const users = await User.find({ role: 'merchant' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${users.length} merchant users`);

    const usersWithFinancialData = users.map(user => ({
      ...user._doc,
      holdAmount: user.holdAmount || 1000,
      unsettleBal: user.unsettleBalance || 1000,
      todayNetPayin: 0,
      availableBal: user.balance || 1000,
      payoutBal: Math.random() > 0.5 ? 1500 : 1000,
      payoutMid: Math.random() > 0.5 ? 'PayoutOne/1 L' : 'NA / NA',
      status: user.status || 'Active'
    }));
    
    res.status(200).json({
      success: true,
      data: usersWithFinancialData
    });
  } catch (error) {
    console.error('❌ Error fetching merchant users:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching merchant users.',
      error: error.message 
    });
  }
};

// Create merchant user
export const createMerchantUser = async (req, res) => {
  try {
    console.log("💰 Creating merchant user:", req.body);
    
    const { firstname, lastname, company, email, password, contact } = req.body;

    // Validation
    if (!firstname || !lastname || !email || !password || !contact) {
      return res.status(400).json({ 
        success: false,
        message: 'Please enter all required fields: firstname, lastname, email, password, contact.' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        message: 'Please enter a valid email address.' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters long.' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: 'User with this email already exists.' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate MID
    const mid = generateMid();

    // Create new merchant user with balance field
    const user = new User({
      firstname,
      lastname,
      company: company || '',
      email,
      password: hashedPassword,
      role: 'merchant',
      contact,
      mid,
      balance: 0, // Initialize balance
      unsettleBalance: 0 // Initialize unsettle balance
    });

    const savedUser = await user.save();
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    
    console.log("✅ Merchant user created successfully:", savedUser._id);

    res.status(201).json({
      success: true,
      message: 'Merchant user created successfully',
      data: userResponse
    });

  } catch (error) {
    console.error('❌ Error creating merchant user:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'A user with this email or MID already exists.' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error while creating merchant user.',
      error: error.message 
    });
  }
};

// Update merchant user
export const updateMerchantUser = async (req, res) => {
  try {
    console.log("🔄 Updating merchant user:", req.params.id, req.body);
    
    const { firstname, lastname, company, email, contact, status, password } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user || user.role !== 'merchant') {
      return res.status(404).json({ 
        success: false,
        message: 'Merchant user not found or is not a merchant.' 
      });
    }

    // Update fields
    if (firstname) user.firstname = firstname;
    if (lastname) user.lastname = lastname;
    if (company !== undefined) user.company = company;
    if (contact) user.contact = contact;
    if (status) user.status = status;

    // Email validation and uniqueness check
    if (email && email !== user.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          success: false,
          message: 'Please enter a valid email address for update.' 
        });
      }
      const existingUserWithEmail = await User.findOne({ email });
      if (existingUserWithEmail && existingUserWithEmail._id.toString() !== userId) {
        return res.status(400).json({ 
          success: false,
          message: 'Another user with this email already exists.' 
        });
      }
      user.email = email;
    }

    // Password update
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ 
          success: false,
          message: 'New password must be at least 6 characters long.' 
        });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await user.save();
    const userResponse = updatedUser.toObject();
    delete userResponse.password;
    
    console.log("✅ Merchant user updated successfully");

    res.status(200).json({
      success: true,
      message: 'Merchant user updated successfully',
      data: userResponse
    });

  } catch (error) {
    console.error('❌ Error updating merchant user:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'A user with this email already exists.' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error while updating merchant user.',
      error: error.message 
    });
  }
};

// Delete merchant user
export const deleteMerchantUser = async (req, res) => {
  try {
    console.log("🗑️ Deleting merchant user:", req.params.id);
    
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found.' 
      });
    }

    if (user.role !== 'merchant') {
      return res.status(403).json({ 
        success: false,
        message: 'Forbidden: Only merchant users can be deleted via this endpoint.' 
      });
    }

    await User.findByIdAndDelete(req.params.id);
    
    console.log("✅ Merchant user deleted successfully");

    res.status(200).json({
      success: true,
      message: 'Merchant user deleted successfully.'
    });

  } catch (error) {
    console.error('❌ Error deleting merchant user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting merchant user.',
      error: error.message 
    });
  }
};

// Get merchant by ID
export const getMerchantById = async (req, res) => {
  try {
    const merchant = await User.findById(req.params.id).select('-password');
    
    if (!merchant || merchant.role !== 'merchant') {
      return res.status(404).json({
        success: false,
        message: 'Merchant not found'
      });
    }

    res.status(200).json({
      success: true,
      data: merchant
    });
  } catch (error) {
    console.error('Error fetching merchant:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};