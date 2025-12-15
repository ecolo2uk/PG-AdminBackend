import IntegrationMethod from "../models/IntegrationMethod.js";

// @desc    Get all integration methods
// @route   GET /api/integration-methods
// @access  Private (e.g., Admin)
export const getIntegrationMethods = async (req, res) => {
  try {
    const methods = await IntegrationMethod.find({ status: "Active" });
    res.status(200).json(methods);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single integration method by ID
// @route   GET /api/integration-methods/:id
// @access  Private (e.g., Admin)
export const getIntegrationMethodById = async (req, res) => {
  try {
    const method = await IntegrationMethod.findById(req.params.id);
    if (method) {
      res.status(200).json(method);
    } else {
      res.status(404).json({ message: "Integration method not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create an integration method
// @route   POST /api/integration-methods
// @access  Private (e.g., Admin)
export const createIntegrationMethod = async (req, res) => {
  const { name } = req.body;

  // Basic validation
  if (!name) {
    return res.status(400).json({ message: "Name is required" });
  }

  try {
    const existingMethod = await IntegrationMethod.findOne({ name });
    if (existingMethod) {
      return res
        .status(400)
        .json({ message: "Integration method with this name already exists" });
    }

    const newMethod = new IntegrationMethod({
      name,
      // iconClass, // Uncomment if adding these fields
      // iconImage,
    });

    const createdMethod = await newMethod.save();
    res.status(201).json(createdMethod);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an integration method
// @route   PUT /api/integration-methods/:id
// @access  Private (e.g., Admin)
export const updateIntegrationMethod = async (req, res) => {
  const { name } = req.body; // Remove iconClass, iconImage if not used

  try {
    const method = await IntegrationMethod.findById(req.params.id);

    if (method) {
      method.name = name || method.name;
      // method.iconClass = iconClass !== undefined ? iconClass : method.iconClass; // Uncomment if adding these fields
      // method.iconImage = iconImage !== undefined ? iconImage : method.iconImage;

      const updatedMethod = await method.save();
      res.status(200).json(updatedMethod);
    } else {
      res.status(404).json({ message: "Integration method not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an integration method
// @route   DELETE /api/integration-methods/:id
// @access  Private (e.g., Admin)
export const deleteIntegrationMethod = async (req, res) => {
  try {
    const method = await IntegrationMethod.findById(req.params.id);

    if (method) {
      //   await IntegrationMethod.deleteOne({ _id: req.params.id });

      const updateIntegrationMethod = await IntegrationMethod.findByIdAndUpdate(
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
      res.status(200).json({ message: "Integration method removed" });
    } else {
      res.status(404).json({ message: "Integration method not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
