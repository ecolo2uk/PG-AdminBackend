import RequiredField from '../models/RequiredFieldModel.js';

// Create a new required field
export const createRequiredField = async (req, res) => {
    try {
        const newField = new RequiredField(req.body);
        const savedField = await newField.save();
        res.status(201).json(savedField);
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};

// Get all required fields
export const getAllRequiredFields = async (req, res) => {
    try {
        const fields = await RequiredField.find({});
        res.status(200).json(fields);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

// Get a single required field by ID
export const getRequiredFieldById = async (req, res) => {
    try {
        const field = await RequiredField.findById(req.params.id);
        if (!field) {
            return res.status(404).json({
                message: 'Required field not found'
            });
        }
        res.status(200).json(field);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};

// Update a required field
export const updateRequiredField = async (req, res) => {
    try {
        const updatedField = await RequiredField.findByIdAndUpdate(
            req.params.id,
            req.body, {
                new: true,
                runValidators: true
            }
        );
        if (!updatedField) {
            return res.status(404).json({
                message: 'Required field not found'
            });
        }
        res.status(200).json(updatedField);
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
};

// Delete a required field
export const deleteRequiredField = async (req, res) => {
    try {
        const deletedField = await RequiredField.findByIdAndDelete(req.params.id);
        if (!deletedField) {
            return res.status(404).json({
                message: 'Required field not found'
            });
        }
        res.status(200).json({
            message: 'Required field deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
};