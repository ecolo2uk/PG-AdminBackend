// controllers/businessSizeController.js
import BusinessSize from '../models/BusinessSize.js';

// @desc    Create a new business size
// @route   POST /api/business-sizes
// @access  Private (You can add auth middleware later)
export const createBusinessSize = async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  try {
    const businessSize = new BusinessSize({
      name,
      iconClass,
      iconImage,
    });

    const createdBusinessSize = await businessSize.save();
    res.status(201).json(createdBusinessSize);
  } catch (error) {
    if (error.code === 11000) { // Duplicate key error
      res.status(400).json({ message: 'Business size with this name already exists.' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};

// @desc    Get all business sizes
// @route   GET /api/business-sizes
// @access  Private
export const getAllBusinessSizes = async (req, res) => {
  try {
    const businessSizes = await BusinessSize.find({});
    res.json(businessSizes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single business size by ID
// @route   GET /api/business-sizes/:id
// @access  Private
export const getBusinessSizeById = async (req, res) => {
  try {
    const businessSize = await BusinessSize.findById(req.params.id);

    if (businessSize) {
      res.json(businessSize);
    } else {
      res.status(404).json({ message: 'Business size not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a business size
// @route   PUT /api/business-sizes/:id
// @access  Private
export const updateBusinessSize = async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  try {
    const businessSize = await BusinessSize.findById(req.params.id);

    if (businessSize) {
      businessSize.name = name || businessSize.name;
      businessSize.iconClass = iconClass || businessSize.iconClass;
      businessSize.iconImage = iconImage || businessSize.iconImage;

      const updatedBusinessSize = await businessSize.save();
      res.json(updatedBusinessSize);
    } else {
      res.status(404).json({ message: 'Business size not found' });
    }
  } catch (error) {
    if (error.code === 11000) { // Duplicate key error
      res.status(400).json({ message: 'Business size with this name already exists.' });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};

// @desc    Delete a business size
// @route   DELETE /api/business-sizes/:id
// @access  Private
export const deleteBusinessSize = async (req, res) => {
  try {
    const businessSize = await BusinessSize.findById(req.params.id);

    if (businessSize) {
      await businessSize.deleteOne(); // Use deleteOne() for Mongoose 6+
      res.json({ message: 'Business size removed' });
    } else {
      res.status(404).json({ message: 'Business size not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};