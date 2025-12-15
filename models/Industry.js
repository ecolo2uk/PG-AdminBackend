import mongoose from "mongoose";

const industrySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // Industry names should be unique
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    default: "Active",
  },
});

// Update 'updatedAt' field on save
industrySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Industry = mongoose.model("Industry", industrySchema);

export default Industry;
