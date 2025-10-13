// controllers/permissionController.js
import Permission from '../models/Permission.js';
import Module from '../models/Module.js';
import Submodule from '../models/Submodule.js';
import Role from '../models/Role.js';
import mongoose from 'mongoose'; // Import mongoose for ObjectId validation

// Get all modules and their submodules with current permissions for a specific role
export const getModuleSubmodulePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      return res.status(400).json({ message: 'Invalid Role ID provided.' });
    }

    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: 'Role not found.' });
    }

    const modules = await Module.find({}).sort({ title: 1 }); // Sort for consistent display
    const submodules = await Submodule.find({}).populate('moduleId').sort({ title: 1 });
    const existingPermissions = await Permission.find({ roleId });

    const formattedData = modules.map(module => {
      const moduleSubmodules = submodules
        .filter(sub => sub.moduleId._id.toString() === module._id.toString())
        .map(sub => {
          const currentPermission = existingPermissions.find(p =>
            p.submoduleId.toString() === sub._id.toString()
          );
          return {
            _id: sub._id,
            // submoduleId: sub.submoduleId, // Not strictly needed, use _id
            title: sub.title,
            url: sub.url,
            operations: currentPermission ? currentPermission.operations : [],
          };
        });

      return {
        _id: module._id,
        // moduleId: module.moduleId, // Not strictly needed, use _id
        title: module.title,
        url: module.url,
        submodules: moduleSubmodules,
      };
    });

    res.status(200).json({
      roleName: role.name,
      modules: formattedData
    });
  } catch (error) {
    console.error('Error fetching modules, submodules, and permissions:', error);
    res.status(500).json({ message: 'Server error while fetching permissions.' });
  }
};

// Save/Update permissions for a specific role
export const saveRolePermissions = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissions } = req.body; // permissions: [{ submoduleId: '...', operations: ['read', 'create'] }]

        // --- Validation ---
        if (!mongoose.Types.ObjectId.isValid(roleId)) {
            return res.status(400).json({ message: 'Invalid Role ID provided.' });
        }

        const roleExists = await Role.findById(roleId);
        if (!roleExists) {
            return res.status(404).json({ message: 'Role not found.' });
        }

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ message: 'Permissions must be an array.' });
        }

        // --- Process Permissions ---
        // Delete existing permissions for this role (important if this were an update, for create it's usually empty)
        await Permission.deleteMany({ roleId });

        // Prepare new permission documents for insertion
        const permissionDocuments = [];
        for (const p of permissions) {
            if (!p.submoduleId || !Array.isArray(p.operations)) {
                console.warn('Skipping malformed permission entry:', p);
                continue;
            }
            if (!mongoose.Types.ObjectId.isValid(p.submoduleId)) {
                console.warn(`Skipping permission for invalid submoduleId: ${p.submoduleId}`);
                continue;
            }

            // Filter to valid operations - your current code does this, good.
            const validOperations = p.operations.filter(op => ['read', 'create', 'update', 'delete'].includes(op));

            if (validOperations.length > 0) { // Only add if there are valid operations
                permissionDocuments.push({
                    roleId,
                    submoduleId: p.submoduleId,
                    operations: validOperations,
                });
            }
        }

        if (permissionDocuments.length > 0) {
            await Permission.insertMany(permissionDocuments);
        }

        res.status(200).json({ message: 'Permissions updated successfully.' });
    } catch (error) {
        console.error('Error saving role permissions:', error);
        res.status(500).json({ message: 'Server error while saving permissions.', details: error.message });
    }
};

// Get all modules and submodules (without permissions, for general display/initial seeding if needed)
export const getAllModulesAndSubmodules = async (req, res) => {
    try {
        const modules = await Module.find({});
        const submodules = await Submodule.find({}).populate('moduleId');

        const formattedData = modules.map(module => {
            return {
                _id: module._id,
                moduleId: module.moduleId,
                title: module.title,
                url: module.url,
                submodules: submodules.filter(sub => sub.moduleId._id.toString() === module._id.toString()).map(sub => ({
                    _id: sub._id,
                    submoduleId: sub.submoduleId,
                    title: sub.title,
                    url: sub.url,
                }))
            };
        });

        res.status(200).json(formattedData);
    } catch (error) {
        console.error('Error fetching all modules and submodules:', error);
        res.status(500).json({ message: 'Server error while fetching modules and submodules.' });
    }
};