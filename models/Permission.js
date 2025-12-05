import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema({
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  submoduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submodule',
    required: true
  },
  operations: {
    type: [String], 

    default: [],
  }
}, { timestamps: true });

permissionSchema.index({ roleId: 1, submoduleId: 1 }, { unique: true });
const Permission = mongoose.model('Permission', permissionSchema);
export default Permission;