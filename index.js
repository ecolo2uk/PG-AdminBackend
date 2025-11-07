// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from 'body-parser';
import connectDB from "./config/db.js";

// Import routes
import adminauthRoutes from "./routes/adminauthRoutes.js";
import adminRoutes from './routes/adminRoutes.js';
import merchantRoutes from './routes/merchantRoutes.js';
import merchantConnectorRoutes from './routes/merchantConnectorRoutes.js';
import pspRoutes from './routes/pspRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import permissionRoutes from './routes/permissionRoutes.js';
import connectorRoutes from './routes/connectorRoutes.js';
import connectorAccountRoutes from './routes/connectorAccountRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js'; // 
import transactionRoutes from './routes/transactionRoutes.js';
import agreementRoutes from './routes/agreementRoutes.js';
import businessSizeRoutes from './routes/businessSizeRoutes.js';
import cryptoWalletRoutes from './routes/cryptoWalletRoutes.js';
import featureRoutes from './routes/featureRoutes.js';
import industryRoutes from './routes/industryRoutes.js';
import integrationMethodRoutes from './routes/integrationMethodRoutes.js';
import paymentMethodRoutes from './routes/paymentMethodRoutes.js';
import paymentOptionRoutes from './routes/paymentOptionRoutes.js';
import pluginRoutes from './routes/pluginRoutes.js';
import solutionRoutes from './routes/solutionRoutes.js';
import requiredFieldRoutes from './routes/requiredFieldRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import riskManagementRoutes from './routes/riskManagementRoutes.js';
import payoutSettlementRoutes from './routes/payoutSettlementRoutes.js';
import payoutTransactionRoutes from './routes/payoutTransactionRoutes.js';
import autoSyncRoutes from './routes/autoSyncRoutes.js';

import { migrateExistingUsersToMerchants } from './utils/migrateExistingUsers.js';

dotenv.config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
connectDB();

// ✅ RUN MIGRATION WHEN SERVER STARTS
// const runMigrations = async () => {
//   try {
//     console.log('🔄 Checking for migration...');
    
//     // Wait for MongoDB connection
//     await mongoose.connection.once('open', async () => {
//       console.log('✅ MongoDB connected, running migration...');
      
//       // Wait 2 seconds to ensure DB is fully connected
//       setTimeout(async () => {
//         await migrateExistingUsersToMerchants();
//       }, 2000);
//     });
    
//   } catch (error) {
//     console.error('❌ Migration startup error:', error);
//   }
// };

// Call migration function
// runMigrations();

// Routes
app.use('/api/admin/auth', adminauthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchantConnector', merchantConnectorRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/psp', pspRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/connectors', connectorRoutes);
app.use('/api/connector-accounts', connectorAccountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/business-sizes', businessSizeRoutes);
app.use('/api/crypto-wallets', cryptoWalletRoutes);
app.use('/api/features', featureRoutes);
app.use('/api/industries', industryRoutes);
app.use('/api/integration-methods', integrationMethodRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/payment-options', paymentOptionRoutes);
app.use('/api/plugins', pluginRoutes);
app.use('/api/solutions', solutionRoutes);
app.use('/api/required-fields', requiredFieldRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/risk-management', riskManagementRoutes);
app.use('/api/payout-settlements', payoutSettlementRoutes);
app.use('/api/payout-transactions', payoutTransactionRoutes);
app.use('/api/sync', autoSyncRoutes);

// Basic root route
app.get('/', (req, res) => {
  res.send('Welcome to the PG Admin API!');
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));