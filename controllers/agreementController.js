import Agreement from "../models/agreement.js";

// Get all agreements
export const getAgreements = async (req, res) => {
  try {
    const agreements = await Agreement.find({ status: "Active" });
    res.status(200).json(agreements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single agreement by ID
export const getAgreementById = async (req, res) => {
  try {
    const { id } = req.params;
    const agreement = await Agreement.findById(id);
    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }
    res.status(200).json(agreement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new agreement
export const createAgreement = async (req, res) => {
  try {
    const { name, type, description } = req.body;
    if (!name || !type) {
      return res.status(400).json({ message: "Name and Type are required" });
    }
    const newAgreement = await Agreement.create({ name, type, description });
    res.status(201).json(newAgreement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an agreement by ID
export const updateAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description } = req.body;

    if (!name || !type) {
      return res.status(400).json({ message: "Name and Type are required" });
    }

    const updatedAgreement = await Agreement.findByIdAndUpdate(
      id,
      { name, type, description },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (!updatedAgreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }
    res.status(200).json(updatedAgreement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete an agreement by ID
export const deleteAgreement = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAgreement = await Agreement.findById(id);
    if (!deletedAgreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }
    const updatedAgreement = await Agreement.findByIdAndUpdate(id, {
      $set: {
        status: "Inactive",
      },
    });
    res.status(200).json({ message: "Agreement deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
