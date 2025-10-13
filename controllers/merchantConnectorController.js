import MerchantConnectorAccount from '../models/MerchantConnectorAccount.js';
import User from '../models/User.js'; // Assuming 'User' is your merchant model
import Connector from '../models/Connector.js';
import ConnectorAccount from '../models/ConnectorAccount.js';

// Helper to generate unique terminal ID
const generateTerminalId = () => {
    return 'PGID' + Math.floor(1000000 + Math.random() * 9000000);
};

// @desc Get all merchant connector accounts for a specific merchant
// @route GET /api/merchantConnector/:merchantId/connector-accounts
// @access Private (assuming authentication middleware)
export const getMerchantConnectorAccounts = async (req, res) => {
    try {
        const { merchantId } = req.params;
        // console.log('Fetching accounts for merchant:', merchantId);

        const merchant = await User.findById(merchantId);
        if (!merchant || merchant.role !== 'merchant') {
            return res.status(404).json({ message: 'Merchant not found or not a merchant user' });
        }

        const accounts = await MerchantConnectorAccount.find({ merchantId })
            .populate('connectorId', 'name type') // Populate connector details
            .populate('connectorAccountId', 'name currency status limits.gatewayFeePercentage') // Populate connector account details including fees
            .sort({ createdAt: -1 });

        // console.log('Found accounts:', accounts);

        const formattedAccounts = accounts.map(account => ({
            _id: account._id,
            terminalId: account.terminalId,
            name: account.connectorAccountId?.name || 'N/A', // Connector account name
            industry: account.industry,
            connector: account.connectorId?.name || 'N/A', // Connector name
            assignedAccount: account.connectorAccountId?.name || 'N/A', // Connector account name
            percentage: account.percentage,
            currency: account.connectorAccountId?.currency || 'INR',
            status: account.status,
            isPrimary: account.isPrimary,
            connectorId: account.connectorId?._id,
            connectorAccountId: account.connectorAccountId?._id,
            // Include gatewayFeePercentage for potential display or calculations in frontend
            gatewayFeePercentage: account.connectorAccountId?.limits?.gatewayFeePercentage || 0,
            createdAt: account.createdAt
        }));

        res.status(200).json(formattedAccounts);

    } catch (error) {
        console.error('Error fetching merchant connector accounts:', error);
        res.status(500).json({ message: 'Server error while fetching merchant connector accounts', error: error.message });
    }
};

// @desc Get available connectors and their accounts not yet assigned to a merchant
// @route GET /api/merchantConnector/:merchantId/available-connectors
// @access Private
export const getAvailableConnectors = async (req, res) => {
    try {
        const { merchantId } = req.params;
        // console.log('Fetching available connectors for merchant:', merchantId);

        const connectors = await Connector.find({ status: 'Active' }).select('name type');

        const connectorsWithAccounts = await Promise.all(
            connectors.map(async (connector) => {
                const accounts = await ConnectorAccount.find({
                    connectorId: connector._id,
                    status: 'Active'
                }).select('name currency');

                // Get IDs of connector accounts already assigned to this merchant for this connector
                const assignedAccountIds = await MerchantConnectorAccount.find({
                    merchantId,
                    connectorId: connector._id
                }).distinct('connectorAccountId');

                // Filter out accounts already assigned
                const availableAccounts = accounts.filter(account =>
                    !assignedAccountIds.includes(account._id)
                );

                return {
                    connector: {
                        _id: connector._id,
                        name: connector.name,
                        type: connector.type
                    },
                    availableAccounts
                };
            })
        );

        // Filter out connectors that have no available accounts for this merchant
        const filteredConnectorsWithAccounts = connectorsWithAccounts.filter(
            item => item.availableAccounts.length > 0
        );

        // console.log('Available connectors:', filteredConnectorsWithAccounts);
        res.status(200).json(filteredConnectorsWithAccounts);

    } catch (error) {
        console.error('Error fetching available connectors:', error);
        res.status(500).json({ message: 'Server error while fetching available connectors', error: error.message });
    }
};

// @desc Add a new connector account to a merchant
// @route POST /api/merchantConnector/:merchantId/connector-accounts
// @access Private
export const addMerchantConnectorAccount = async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { connectorId, connectorAccountId, industry, percentage, isPrimary } = req.body;

        // console.log('Adding connector account:', { merchantId, connectorId, connectorAccountId, industry, percentage, isPrimary });

        if (!connectorId || !connectorAccountId) {
            return res.status(400).json({
                message: 'Connector ID and Connector Account ID are required'
            });
        }

        const merchant = await User.findById(merchantId);
        if (!merchant || merchant.role !== 'merchant') {
            return res.status(404).json({ message: 'Merchant not found or not a merchant user' });
        }

        const connector = await Connector.findById(connectorId);
        if (!connector) {
            return res.status(404).json({ message: 'Connector not found' });
        }

        const connectorAccount = await ConnectorAccount.findById(connectorAccountId);
        if (!connectorAccount) {
            return res.status(404).json({ message: 'Connector account not found' });
        }

        const existingAccount = await MerchantConnectorAccount.findOne({
            merchantId,
            connectorAccountId // Check if this specific connector account is already assigned
        });

        if (existingAccount) {
            return res.status(400).json({
                message: 'This connector account is already assigned to the merchant.'
            });
        }

        // If setting as primary, ensure only one primary per merchant
        if (isPrimary) {
            await MerchantConnectorAccount.updateMany(
                { merchantId, isPrimary: true },
                { $set: { isPrimary: false } }
            );
        }

        let terminalId;
        let isUnique = false;
        while (!isUnique) {
            terminalId = generateTerminalId();
            const existingTerminal = await MerchantConnectorAccount.findOne({ terminalId });
            if (!existingTerminal) {
                isUnique = true;
            }
        }

        const newMerchantConnectorAccount = new MerchantConnectorAccount({
            merchantId,
            connectorId,
            connectorAccountId,
            terminalId,
            industry: industry || 'Gaming',
            percentage: percentage !== undefined ? percentage : 100,
            isPrimary: isPrimary || false,
            status: 'Active'
        });

        const savedAccount = await newMerchantConnectorAccount.save();

        const populatedAccount = await MerchantConnectorAccount.findById(savedAccount._id)
            .populate('connectorId', 'name type')
            .populate('connectorAccountId', 'name currency status limits.gatewayFeePercentage');

        res.status(201).json({
            _id: populatedAccount._id,
            terminalId: populatedAccount.terminalId,
            name: populatedAccount.connectorAccountId.name,
            industry: populatedAccount.industry,
            connector: populatedAccount.connectorId.name,
            assignedAccount: populatedAccount.connectorAccountId.name,
            percentage: populatedAccount.percentage,
            currency: populatedAccount.connectorAccountId.currency,
            status: populatedAccount.status,
            isPrimary: populatedAccount.isPrimary,
            gatewayFeePercentage: populatedAccount.connectorAccountId?.limits?.gatewayFeePercentage || 0,
            createdAt: populatedAccount.createdAt
        });

    } catch (error) {
        console.error('Error adding merchant connector account:', error);
        res.status(500).json({ message: 'Server error while adding merchant connector account', error: error.message });
    }
};

// @desc Update an existing merchant connector account
// @route PUT /api/merchantConnector/connector-accounts/:accountId
// @access Private
export const updateMerchantConnectorAccount = async (req, res) => {
    try {
        const { accountId } = req.params;
        const { industry, percentage, isPrimary, status } = req.body;

        // console.log('Updating account:', accountId, { industry, percentage, isPrimary, status });

        const account = await MerchantConnectorAccount.findById(accountId);
        if (!account) {
            return res.status(404).json({ message: 'Merchant connector account not found' });
        }

        // If setting as primary, remove primary status from other accounts of the same merchant
        if (isPrimary && !account.isPrimary) { // Only if it's becoming primary and wasn't already
            await MerchantConnectorAccount.updateMany(
                {
                    merchantId: account.merchantId,
                    _id: { $ne: accountId }, // Exclude the current account
                    isPrimary: true
                },
                { $set: { isPrimary: false } }
            );
        }

        // Update fields
        if (industry !== undefined) account.industry = industry;
        if (percentage !== undefined) account.percentage = percentage;
        if (isPrimary !== undefined) account.isPrimary = isPrimary;
        if (status !== undefined) account.status = status;

        const updatedAccount = await account.save();

        const populatedAccount = await MerchantConnectorAccount.findById(updatedAccount._id)
            .populate('connectorId', 'name type')
            .populate('connectorAccountId', 'name currency status limits.gatewayFeePercentage');

        res.status(200).json({
            _id: populatedAccount._id,
            terminalId: populatedAccount.terminalId,
            name: populatedAccount.connectorAccountId.name,
            industry: populatedAccount.industry,
            connector: populatedAccount.connectorId.name,
            assignedAccount: populatedAccount.connectorAccountId.name,
            percentage: populatedAccount.percentage,
            currency: populatedAccount.connectorAccountId.currency,
            status: populatedAccount.status,
            isPrimary: populatedAccount.isPrimary,
            gatewayFeePercentage: populatedAccount.connectorAccountId?.limits?.gatewayFeePercentage || 0,
            createdAt: populatedAccount.createdAt
        });

    } catch (error) {
        console.error('Error updating merchant connector account:', error);
        res.status(500).json({ message: 'Server error while updating merchant connector account', error: error.message });
    }
};


// @desc Delete a merchant connector account
// @route DELETE /api/merchantConnector/connector-accounts/:accountId
// @access Private
export const deleteMerchantConnectorAccount = async (req, res) => {
    try {
        const { accountId } = req.params;

        const account = await MerchantConnectorAccount.findById(accountId);
        if (!account) {
            return res.status(404).json({ message: 'Merchant connector account not found' });
        }

        await MerchantConnectorAccount.findByIdAndDelete(accountId);

        res.status(200).json({ message: 'Merchant connector account deleted successfully' });

    } catch (error) {
        console.error('Error deleting merchant connector account:', error);
        res.status(500).json({ message: 'Server error while deleting merchant connector account', error: error.message });
    }
};

// @desc Set a merchant connector account as primary
// @route PATCH /api/merchantConnector/connector-accounts/:accountId/primary
// @access Private
export const setPrimaryAccount = async (req, res) => {
    try {
        const { accountId } = req.params;

        const account = await MerchantConnectorAccount.findById(accountId);
        if (!account) {
            return res.status(404).json({ message: 'Merchant connector account not found' });
        }

        // If it's already primary, no action needed
        if (account.isPrimary) {
            return res.status(200).json({ message: 'Account is already primary' });
        }

        // Remove primary status from all other accounts of the same merchant
        await MerchantConnectorAccount.updateMany(
            {
                merchantId: account.merchantId,
                _id: { $ne: accountId }, // Exclude the current account
                isPrimary: true
            },
            { $set: { isPrimary: false } }
        );

        // Set this account as primary
        account.isPrimary = true;
        await account.save();

        res.status(200).json({ message: 'Account set as primary successfully' });

    } catch (error) {
        console.error('Error setting primary account:', error);
        res.status(500).json({ message: 'Server error while setting primary account', error: error.message });
    }
};

// NEW FUNCTIONS FOR ACTIONS MENU (Set Limits, Change Rates, Show Rates, View Detail)

// @desc Get limits for a specific merchant connector account
// @route GET /api/merchantConnector/connector-accounts/:accountId/limits
// @access Private
export const getAccountLimits = async (req, res) => {
    try {
        const { accountId } = req.params;
        const merchantConnAccount = await MerchantConnectorAccount.findById(accountId)
            .populate({
                path: 'connectorAccountId',
                select: 'name limits currency'
            });

        if (!merchantConnAccount) {
            return res.status(404).json({ message: 'Merchant connector account not found' });
        }

        if (!merchantConnAccount.connectorAccountId) {
            return res.status(404).json({ message: 'Associated connector account not found' });
        }

        const limits = merchantConnAccount.connectorAccountId.limits;
        const name = merchantConnAccount.connectorAccountId.name;
        const defaultCurrency = merchantConnAccount.connectorAccountId.currency; // Use connector account's currency

        res.status(200).json({ name, defaultCurrency, ...limits });

    } catch (error) {
        console.error('Error fetching account limits:', error);
        res.status(500).json({ message: 'Server error while fetching account limits', error: error.message });
    }
};

// @desc Update limits for a specific merchant connector account
// @route PUT /api/merchantConnector/connector-accounts/:accountId/limits
// @access Private
export const updateAccountLimits = async (req, res) => {
    try {
        const { accountId } = req.params;
        const updatedFields = req.body; // Expects an object with limit fields

        const merchantConnAccount = await MerchantConnectorAccount.findById(accountId)
            .populate('connectorAccountId');

        if (!merchantConnAccount) {
            return res.status(404).json({ message: 'Merchant connector account not found' });
        }
        if (!merchantConnAccount.connectorAccountId) {
            return res.status(404).json({ message: 'Associated connector account not found' });
        }

        const connectorAccount = merchantConnAccount.connectorAccountId;

        // Apply updates to the limits subdocument
        Object.keys(updatedFields).forEach(key => {
            if (connectorAccount.limits[key] !== undefined) {
                // Handle specific types or arrays if necessary, e.g., acceptedCountries
                if (Array.isArray(connectorAccount.limits[key])) {
                    // For array fields, replace the whole array
                    connectorAccount.limits[key] = updatedFields[key];
                } else {
                    // For other fields, just assign
                    connectorAccount.limits[key] = updatedFields[key];
                }
            }
        });

        await connectorAccount.save();

        res.status(200).json({ message: 'Account limits updated successfully', limits: connectorAccount.limits });

    } catch (error) {
        console.error('Error updating account limits:', error);
        res.status(500).json({ message: 'Server error while updating account limits', error: error.message });
    }
};

// @desc Get rates for a specific merchant connector account (used by Change Rates & Show Rates)
// @route GET /api/merchantConnector/connector-accounts/:accountId/rates
// @access Private
export const getAccountRates = async (req, res) => {
    try {
        const { accountId } = req.params;
        const merchantConnAccount = await MerchantConnectorAccount.findById(accountId)
            .populate({
                path: 'merchantId',
                select: 'email' // Assuming User model has email
            })
            .populate({
                path: 'connectorId',
                select: 'name'
            })
            .populate({
                path: 'connectorAccountId',
                select: 'name limits' // limits contains gatewayFeePercentage
            });

        if (!merchantConnAccount) {
            return res.status(404).json({ message: 'Merchant connector account not found' });
        }

        const connectorAccount = merchantConnAccount.connectorAccountId;
        if (!connectorAccount) {
            return res.status(404).json({ message: 'Associated connector account not found' });
        }

        // Static or default rates for demonstration, these would ideally come from the ConnectorAccount model or a more complex rate system
        const rates = {
            upiMdrPercentage: 7.00, // Example value, can be stored in ConnectorAccount or elsewhere
            gatewayFeePercentage: connectorAccount.limits?.gatewayFeePercentage || 4.50, // Fetched from limits
            rollingReservePercentage: 0.00,
            rollingReserveReleaseDays: 0,
            successTransactionFee: 0.00,
            chargebackFee: 0.00,
            refundFee: 1000.00,
            setupFee: 0.00,
        };

        res.status(200).json({
            merchantName: merchantConnAccount.merchantId?.name || 'Marina', // Assuming merchant has a name field
            merchantEmail: merchantConnAccount.merchantId?.email || 'contact@zoomupi.com',
            connectorName: merchantConnAccount.connectorId?.name || 'N/A',
            connectorAccountName: connectorAccount.name || 'N/A',
            ...rates
        });

    } catch (error) {
        console.error('Error fetching account rates:', error);
        res.status(500).json({ message: 'Server error while fetching account rates', error: error.message });
    }
};


// @desc Update rates for a specific merchant connector account (simulated, as rates are currently static/default)
// @route PUT /api/merchantConnector/connector-accounts/:accountId/rates
// @access Private
export const updateAccountRates = async (req, res) => {
    try {
        const { accountId } = req.params;
        const { gatewayFeePercentage, ...otherRates } = req.body; // Expects an object with rate fields

        const merchantConnAccount = await MerchantConnectorAccount.findById(accountId)
            .populate('connectorAccountId');

        if (!merchantConnAccount) {
            return res.status(404).json({ message: 'Merchant connector account not found' });
        }
        if (!merchantConnAccount.connectorAccountId) {
            return res.status(404).json({ message: 'Associated connector account not found' });
        }

        const connectorAccount = merchantConnAccount.connectorAccountId;

        // Update the gatewayFeePercentage in the limits subdocument of ConnectorAccount
        if (gatewayFeePercentage !== undefined) {
            connectorAccount.limits.gatewayFeePercentage = gatewayFeePercentage;
        }

        // If you had other rates stored in ConnectorAccount model, you would update them here:
        // Object.keys(otherRates).forEach(key => {
        //     if (connectorAccount[key] !== undefined) { // Or a 'rates' subdocument
        //         connectorAccount[key] = otherRates[key];
        //     }
        // });

        await connectorAccount.save();

        res.status(200).json({ message: 'Account rates updated successfully' });

    } catch (error) {
        console.error('Error updating account rates:', error);
        res.status(500).json({ message: 'Server error while updating account rates', error: error.message });
    }
};

// @desc Get full details for a specific merchant connector account
// @route GET /api/merchantConnector/connector-accounts/:accountId/details
// @access Private
export const getAccountDetails = async (req, res) => {
    try {
        const { accountId } = req.params;
        const merchantConnAccount = await MerchantConnectorAccount.findById(accountId)
            .populate({
                path: 'merchantId',
                select: 'name email'
            })
            .populate({
                path: 'connectorId',
                select: 'name type'
            })
            .populate({
                path: 'connectorAccountId',
                select: 'name currency status limits integrationKeys'
            });

        if (!merchantConnAccount) {
            return res.status(404).json({ message: 'Merchant connector account not found' });
        }
        if (!merchantConnAccount.connectorAccountId) {
            return res.status(404).json({ message: 'Associated connector account not found' });
        }

        const connectorAccount = merchantConnAccount.connectorAccountId;

        // Rates are currently static/default, fetch them similarly to getAccountRates
        const currentRates = {
            upiMdrPercentage: 7.00,
            gatewayFeePercentage: connectorAccount.limits?.gatewayFeePercentage || 4.50,
            rollingReservePercentage: 0.00,
            rollingReserveReleaseDays: 0,
            successTransactionFee: 0.00,
            chargebackFee: 0.00,
            refundFee: 1000.00,
            setupFee: 0.00,
        };

        res.status(200).json({
            merchantName: merchantConnAccount.merchantId?.name || 'Marina',
            merchantEmail: merchantConnAccount.merchantId?.email || 'contact@zoomupi.com',
            connectorName: merchantConnAccount.connectorId?.name || 'N/A',
            connectorAccountName: connectorAccount.name || 'N/A',
            approvedDate: merchantConnAccount.createdAt, // Using createdAt for approved date
            currentRates,
            allAgreements: [{ id: 'agreement1', name: 'Agreement - 1', url: '/agreements/agreement-1.pdf' }] // Example
        });

    } catch (error) {
        console.error('Error fetching account details:', error);
        res.status(500).json({ message: 'Server error while fetching account details', error: error.message });
    }
};