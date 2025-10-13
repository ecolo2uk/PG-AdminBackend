import express from 'express';
import {
    getMerchantConnectorAccounts,
    addMerchantConnectorAccount,
    updateMerchantConnectorAccount,
    deleteMerchantConnectorAccount,
    getAvailableConnectors,
    setPrimaryAccount,
    getAccountLimits, // New
    updateAccountLimits, // New
    getAccountRates, // New
    updateAccountRates, // New
    getAccountDetails // New
} from '../controllers/merchantConnectorController.js';

const router = express.Router();

// Merchant Connector Accounts
router.get('/:merchantId/connector-accounts', getMerchantConnectorAccounts);
router.get('/:merchantId/available-connectors', getAvailableConnectors);
router.post('/:merchantId/connector-accounts', addMerchantConnectorAccount);
router.put('/connector-accounts/:accountId', updateMerchantConnectorAccount);
router.delete('/connector-accounts/:accountId', deleteMerchantConnectorAccount);
router.patch('/connector-accounts/:accountId/primary', setPrimaryAccount);

// Actions specific to an account (Set Limits, Change Rates, Show Rates, View Detail)
router.get('/connector-accounts/:accountId/limits', getAccountLimits); // For "Set Limits"
router.put('/connector-accounts/:accountId/limits', updateAccountLimits); // For "Set Limits" update
router.get('/connector-accounts/:accountId/rates', getAccountRates); // For "Change Rates" and "Show Rates"
router.put('/connector-accounts/:accountId/rates', updateAccountRates); // For "Change Rates" update
router.get('/connector-accounts/:accountId/details', getAccountDetails); // For "View Detail"

export default router;