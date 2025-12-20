// controllers/roleController.js
import Role from "../models/Role.js";
import Permission from "../models/Permission.js"; // Import Permission model

// Create a new role
export const createRole = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Role name is required." });
    }

    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res
        .status(409)
        .json({ message: "Role with this name already exists." });
    }

    const newRole = new Role({ name });
    await newRole.save();
    res.status(201).json(newRole);
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ message: "Server error while creating role." });
  }
};

// Get all roles
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ active: 0 });
    res.status(200).json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Server error while fetching roles." });
  }
};

// Get a single role by ID
export const getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }
    res.status(200).json(role);
  } catch (error) {
    console.error("Error fetching role by ID:", error);
    res.status(500).json({ message: "Server error while fetching role." });
  }
};

// Update a role
export const updateRole = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Role name is required." });
    }

    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    const existingRole = await Role.findOne({
      name,
      _id: { $ne: req.params.id },
    });
    if (existingRole) {
      return res
        .status(409)
        .json({ message: "Role with this name already exists." });
    }

    role.name = name;
    await role.save();
    res.status(200).json(role);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ message: "Server error while updating role." });
  }
};

// Delete a role and its associated permissions
// export const deleteRole = async (req, res) => {
//   try {
//     const role = await Role.findByIdAndDelete(req.params.id);
//     if (!role) {
//       return res.status(404).json({ message: 'Role not found.' });
//     }

//     // Also delete all permissions associated with this role
//     await Permission.deleteMany({ roleId: req.params.id });

//     res.status(200).json({ message: 'Role and associated permissions deleted successfully.' });
//   } catch (error) {
//     console.error('Error deleting role:', error);
//     res.status(500).json({ message: 'Server error while deleting role.' });
//   }
// };

export const deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    await Role.findByIdAndUpdate(req.params.id, {
      active: 1,
      deletedAt: Date.now(),
    });

    await Permission.updateMany(
      { roleId: req.params.id },
      {
        active: 1,
        deletedAt: Date.now(),
      }
    );

    res.status(200).json({
      message: "Role and associated permissions soft deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting role:", error);
    res.status(500).json({ message: "Server error while deleting role." });
  }
};
