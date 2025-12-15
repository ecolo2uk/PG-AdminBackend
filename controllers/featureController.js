// controllers/featureController.js
import asyncHandler from "express-async-handler"; // Assuming you've installed this
import Feature from "../models/featureModel.js"; // Adjust path if necessary

// @desc    Get all features
// @route   GET /api/features
// @access  Public (or Private/Admin if you add middleware)
export const getFeatures = asyncHandler(async (req, res) => {
  const features = await Feature.find({ status: "Active" });
  res.json(features);
});

// @desc    Get single feature by ID
// @route   GET /api/features/:id
// @access  Public (or Private/Admin)
export const getFeatureById = asyncHandler(async (req, res) => {
  const feature = await Feature.findById(req.params.id);
  if (feature) {
    res.json(feature);
  } else {
    res.status(404).json({ message: "Feature not found" });
  }
});

// @desc    Create a new feature
// @route   POST /api/features
// @access  Private/Admin
export const createFeature = asyncHandler(async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  // Basic validation
  if (!name) {
    res.status(400);
    throw new Error("Feature name is required");
  }

  const featureExists = await Feature.findOne({ name });

  if (featureExists) {
    res.status(400);
    throw new Error("Feature with this name already exists");
  }

  const feature = new Feature({
    name,
    iconClass,
    iconImage,
  });

  const createdFeature = await feature.save();
  res.status(201).json(createdFeature);
});

// @desc    Update a feature
// @route   PUT /api/features/:id
// @access  Private/Admin
export const updateFeature = asyncHandler(async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  const feature = await Feature.findById(req.params.id);

  if (feature) {
    feature.name = name || feature.name;
    feature.iconClass = iconClass || feature.iconClass;
    feature.iconImage = iconImage || feature.iconImage;

    const updatedFeature = await feature.save();
    res.json(updatedFeature);
  } else {
    res.status(404);
    throw new Error("Feature not found");
  }
});

// @desc    Delete a feature
// @route   DELETE /api/features/:id
// @access  Private/Admin
export const deleteFeature = asyncHandler(async (req, res) => {
  const feature = await Feature.findById(req.params.id);

  if (feature) {
    // await Feature.deleteOne({ _id: feature._id }); // Use deleteOne or findByIdAndDelete
    const updateFeature = await Feature.findByIdAndUpdate(
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
    res.json({ message: "Feature removed" });
  } else {
    res.status(404);
    throw new Error("Feature not found");
  }
});
