// backend/controllers/connectorAccountController.js
import ConnectorAccount from '../models/ConnectorAccount.js';
import Connector from '../models/Connector.js';

// Get all connector accounts for a specific connector
export const getConnectorAccountsByConnectorId = async (req, res) => { // Changed exports.getConnectorAccountsByConnectorId
  try {
    const accounts = await ConnectorAccount.find({ connectorId: req.params.connectorId }).sort({ createdAt: -1 });
    res.status(200).json(accounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single connector account by ID
export const getConnectorAccountById = async (req, res) => { // Changed exports.getConnectorAccountById
  try {
    const account = await ConnectorAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ message: 'Connector Account not found' });
    res.status(200).json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a new connector account
export const createConnectorAccount = async (req, res) => {
  const { connectorId } = req.params;
  const { name, currency, integrationKeys } = req.body;

  try {
    // Validate if connector exists
    const connector = await Connector.findById(connectorId);
    if (!connector) {
      return res.status(404).json({ message: 'Parent Connector not found' });
    }

    // Validate that all required credentials are provided
    if (connector.credentials && connector.credentials.length > 0) {
      for (const cred of connector.credentials) {
        if (!integrationKeys[cred.credentialName]) {
          return res.status(400).json({ 
            message: `Missing required credential: ${cred.credentialTitle}` 
          });
        }
      }
    }

    const newAccount = new ConnectorAccount({
      connectorId,
      name,
      currency,
      integrationKeys,
    });

    const savedAccount = await newAccount.save();
    res.status(201).json(savedAccount);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update a connector account
export const updateConnectorAccount = async (req, res) => {
  try {
    const updatedAccount = await ConnectorAccount.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedAccount) return res.status(404).json({ message: 'Connector Account not found' });
    res.status(200).json(updatedAccount);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete a connector account
export const deleteConnectorAccount = async (req, res) => { // Changed exports.deleteConnectorAccount
  try {
    const account = await ConnectorAccount.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ message: 'Connector Account not found' });
    res.status(200).json({ message: 'Connector Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update connector account status (Active/Deactivated)
export const updateConnectorAccountStatus = async (req, res) => { // Changed exports.updateConnectorAccountStatus
  try {
    const { status } = req.body; // Expect 'Active' or 'Deactivated'
    const account = await ConnectorAccount.findByIdAndUpdate(
      req.params.id,
      { status: status },
      { new: true, runValidators: true }
    );
    if (!account) return res.status(404).json({ message: 'Connector Account not found' });
    res.status(200).json(account);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update connector account limits
export const updateConnectorAccountLimits = async (req, res) => { // Changed exports.updateConnectorAccountLimits
  try {
    const { limits } = req.body; // Expect an object containing limit fields
    const account = await ConnectorAccount.findByIdAndUpdate(
      req.params.id,
      { $set: { limits: limits } }, // Use $set to update sub-document
      { new: true, runValidators: true }
    );
    if (!account) return res.status(404).json({ message: 'Connector Account not found' });
    res.status(200).json(account);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};