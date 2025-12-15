// backend/controllers/solutionController.js
import Solution from "../models/Solution.js";

// @desc    Get all solutions
// @route   GET /api/solutions
// @access  Public (or Private, depending on your auth middleware)
export const getSolutions = async (req, res) => {
  try {
    const solutions = await Solution.find({ status: "Active" });
    res.status(200).json(solutions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single solution by ID
// @route   GET /api/solutions/:id
// @access  Public (or Private)
export const getSolutionById = async (req, res) => {
  try {
    const solution = await Solution.findById(req.params.id);
    if (solution) {
      res.status(200).json(solution);
    } else {
      res.status(404).json({ message: "Solution not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new solution
// @route   POST /api/solutions
// @access  Private (e.g., admin only)
export const createSolution = async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Solution name is required" });
  }

  try {
    const existingSolution = await Solution.findOne({ name });
    if (existingSolution) {
      return res
        .status(400)
        .json({ message: "A solution with this name already exists" });
    }

    const solution = new Solution({
      name,
      iconClass,
      iconImage,
    });

    const createdSolution = await solution.save();
    res.status(201).json(createdSolution);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a solution
// @route   PUT /api/solutions/:id
// @access  Private (e.g., admin only)
export const updateSolution = async (req, res) => {
  const { name, iconClass, iconImage } = req.body;

  try {
    const solution = await Solution.findById(req.params.id);

    if (solution) {
      if (name !== solution.name) {
        const existingSolution = await Solution.findOne({ name });
        if (
          existingSolution &&
          String(existingSolution._id) !== String(solution._id)
        ) {
          return res
            .status(400)
            .json({ message: "A solution with this name already exists" });
        }
      }

      solution.name = name || solution.name;
      solution.iconClass =
        iconClass !== undefined ? iconClass : solution.iconClass;
      solution.iconImage =
        iconImage !== undefined ? iconImage : solution.iconImage;
      // Mongoose pre-save hook will update 'updatedAt'

      const updatedSolution = await solution.save();
      res.status(200).json(updatedSolution);
    } else {
      res.status(404).json({ message: "Solution not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a solution
// @route   DELETE /api/solutions/:id
// @access  Private (e.g., admin only)
export const deleteSolution = async (req, res) => {
  try {
    const solution = await Solution.findById(req.params.id);

    if (solution) {
      // await solution.deleteOne(); // Use deleteOne()
      const updateSolution = await Solution.findByIdAndUpdate(
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
      res.status(200).json({ message: "Solution removed" });
    } else {
      res.status(404).json({ message: "Solution not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
