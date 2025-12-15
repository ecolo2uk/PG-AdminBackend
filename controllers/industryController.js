import Industry from "../models/Industry.js";

// Get all industries
export const getIndustries = async (req, res) => {
  try {
    const industries = await Industry.find({ status: "Active" });
    res.status(200).json(industries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single industry by ID
export const getIndustryById = async (req, res) => {
  try {
    const { id } = req.params;
    const industry = await Industry.findById(id);
    if (!industry) {
      return res.status(404).json({ message: "Industry not found" });
    }
    res.status(200).json(industry);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new industry
export const createIndustry = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Industry name is required" });
    }

    const newIndustry = new Industry({ name });
    await newIndustry.save();
    res.status(201).json(newIndustry);
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(409)
        .json({ message: "Industry with this name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

// Update an industry
export const updateIndustry = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Industry name is required" });
    }

    const updatedIndustry = await Industry.findByIdAndUpdate(
      id,
      { name, updatedAt: Date.now() },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (!updatedIndustry) {
      return res.status(404).json({ message: "Industry not found" });
    }

    res.status(200).json(updatedIndustry);
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      return res
        .status(409)
        .json({ message: "Industry with this name already exists" });
    }
    res.status(500).json({ message: error.message });
  }
};

// Delete an industry
export const deleteIndustry = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedIndustry = await Industry.findById(id);

    if (!deletedIndustry) {
      return res.status(404).json({ message: "Industry not found" });
    }

    const updateIndustry = await Industry.findByIdAndUpdate(
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

    res.status(200).json({ message: "Industry deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
