import mongoose from "mongoose";

const SolutionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  iconClass: {
    type: String,
    required: false,
  },
  iconImage: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

SolutionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Solution = mongoose.model("Solution", SolutionSchema);
export default Solution;
