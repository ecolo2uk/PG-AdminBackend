import mongoose from 'mongoose';

const submoduleSchema = new mongoose.Schema({
  submoduleId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  moduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Module',
    required: true
  }
}, { timestamps: true });

const Submodule = mongoose.model('Submodule', submoduleSchema);
export default Submodule;