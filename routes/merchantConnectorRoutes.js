import express from 'express';
import {
    getMerchantConnectorAccounts,
    addMerchantConnectorAccount,
    updateMerchantConnectorAccount,
    deleteMerchantConnectorAccount,
    getAvailableConnectors,
    setPrimaryAccount,
    getAccountLimits,
    updateAccountLimits,
    getAccountRates,
    updateAccountRates,
    getAccountDetails
} from '../controllers/merchantConnectorController.js';

const router = express.Router();

router.get('/:merchantId/connector-accounts', getMerchantConnectorAccounts);
router.get('/:merchantId/available-connectors', getAvailableConnectors);
router.post('/:merchantId/connector-accounts', addMerchantConnectorAccount);
router.put('/connector-accounts/:accountId', updateMerchantConnectorAccount);
router.delete('/connector-accounts/:accountId', deleteMerchantConnectorAccount);
router.patch('/connector-accounts/:accountId/primary', setPrimaryAccount);

router.get('/connector-accounts/:accountId/limits', getAccountLimits);
router.put('/connector-accounts/:accountId/limits', updateAccountLimits);
router.get('/connector-accounts/:accountId/rates', getAccountRates);
router.put('/connector-accounts/:accountId/rates', updateAccountRates);
router.get('/connector-accounts/:accountId/details', getAccountDetails);

export default router;