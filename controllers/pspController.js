import User from "../models/User.js";
import bcrypt from "bcryptjs";

// Get all PSP users
export const getPSPUsers = async (req, res) => {
  // Changed here
  try {
    const users = await User.find({ role: "psp", status: "Active" }).sort({
      createdAt: -1,
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create PSP user
export const createPSPUser = async (req, res) => {
  // Changed here
  try {
    const { firstname, lastname, email, password, company, contact } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate PSP ID
    const pspId = "PSP" + Date.now();

    // Create user
    const user = new User({
      firstname,
      lastname,
      email,
      password: hashedPassword,
      role: "psp",
      company,
      contact,
      pspId,
    });

    const savedUser = await user.save();
    res.status(201).json(savedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update PSP user
export const updatePSPUser = async (req, res) => {
  // Changed here
  try {
    const { firstname, lastname, email, company, contact, status } = req.body;

    const user = await User.findById(req.params.id);
    if (!user || user.role !== "psp") {
      return res.status(404).json({ message: "PSP user not found" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { firstname, lastname, email, company, contact, status },
      { new: true }
    );

    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete PSP user
export const deletePSPUser = async (req, res) => {
  // Changed here
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role !== "psp") {
      return res.status(404).json({ message: "PSP user not found" });
    }

    // await User.findByIdAndDelete(req.params.id);
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "Inactive",
        },
      },
      {
        new: true,
      }
    );
    res.json({ message: "PSP user deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
