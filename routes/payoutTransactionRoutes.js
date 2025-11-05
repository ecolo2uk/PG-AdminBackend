// Add to your backend routes file (payoutTransactionRoutes.js)
import express from 'express';
import {
  getPayoutTransactions,
  getMerchantList,
  getConnectorList,
  createPayoutTransaction,
  getMerchantTransactionsSummary,
  exportPayoutTransactions,
  updatePayoutTransactionStatus,
} from '../controllers/payoutTransactionController.js';

const router = express.Router();

// Add test routes first
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payout Transactions API is working!',
    timestamp: new Date().toISOString()
  });
});

router.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Payout API is healthy',
    timestamp: new Date().toISOString()
  });
});


// Add this test route to debug database issues
router.get('/debug/database', async (req, res) => {
  try {
    console.log("🧪 Testing database connection...");
    
    const dbState = mongoose.connection.readyState;
    const dbStats = {
      state: dbState,
      stateName: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState],
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState
    };

    // Test User collection
    const userCount = await User.countDocuments();
    const merchantCount = await User.countDocuments({ role: 'merchant' });
    
    res.json({
      success: true,
      database: dbStats,
      counts: {
        totalUsers: userCount,
        merchants: merchantCount
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Database test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}); 

// Add this to your payoutTransactionRoutes.js
router.post('/test-create', (req, res) => {
  console.log("🧪 Test POST received:", req.body);
  res.json({ 
    success: true, 
    message: 'POST endpoint is working!',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});


// Your existing routes
router.get('/', getPayoutTransactions);
router.post('/', createPayoutTransaction); // This is the missing route!

router.patch('/:id/status', updatePayoutTransactionStatus);
router.get('/merchants/list', getMerchantList);
router.get('/connectors/list', getConnectorList);
router.get('/merchant/:merchantId/transactions', getMerchantTransactionsSummary);
router.get('/export/excel', exportPayoutTransactions);

export default router;