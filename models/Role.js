import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    active: {
      type: Number,
      default: 0,
    },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

const Role = mongoose.model("Role", roleSchema);
export default Role;
