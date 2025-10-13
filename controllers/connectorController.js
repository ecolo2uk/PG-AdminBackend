// backend/controllers/connectorController.js
import Connector from '../models/Connector.js';
import ConnectorAccount from '../models/ConnectorAccount.js';

// Get all connectors
export const getAllConnectors = async (req, res) => { // Changed exports.getAllConnectors
  try {
    const { type } = req.query; // 'UPI' or 'Card'
    const query = type ? { connectorType: type } : {};
    const connectors = await Connector.find(query).sort({ createdAt: -1 });
    res.status(200).json(connectors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single connector by ID
export const getConnectorById = async (req, res) => { // Changed exports.getConnectorById
  try {
    const connector = await Connector.findById(req.params.id);
    if (!connector) return res.status(404).json({ message: 'Connector not found' });
    res.status(200).json(connector);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a new connector
export const createConnector = async (req, res) => { // Changed exports.createConnector
  const {
    name,
    className,
    connectorType,
    expireAfterMinutes,
    isPayoutSupport,
    isPayoutBulkUploadSupport,
    credentials,
    times,
    requiredFields
  } = req.body;

  const newConnector = new Connector({
    name,
    className,
    connectorType,
    expireAfterMinutes,
    isPayoutSupport,
    isPayoutBulkUploadSupport,
    credentials,
    times,
    requiredFields
  });

  try {
    const savedConnector = await newConnector.save();
    res.status(201).json(savedConnector);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update a connector
export const updateConnector = async (req, res) => { // Changed exports.updateConnector
  try {
    const updatedConnector = await Connector.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedConnector) return res.status(404).json({ message: 'Connector not found' });
    res.status(200).json(updatedConnector);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete a connector (and its associated accounts)
export const deleteConnector = async (req, res) => { // Changed exports.deleteConnector
  try {
    const connector = await Connector.findById(req.params.id);
    if (!connector) return res.status(404).json({ message: 'Connector not found' });

    // Optionally, delete all associated connector accounts
    await ConnectorAccount.deleteMany({ connectorId: req.params.id });

    await Connector.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Connector and its accounts deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Deactivate/Activate a connector
export const updateConnectorStatus = async (req, res) => { // Changed exports.updateConnectorStatus
  try {
    const { status } = req.body; // Expect 'Active' or 'Deactivated'
    const connector = await Connector.findByIdAndUpdate(
      req.params.id,
      { status: status },
      { new: true, runValidators: true }
    );
    if (!connector) return res.status(404).json({ message: 'Connector not found' });
    res.status(200).json(connector);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};