import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from 'body-parser';
import connectDB from "./config/db.js"; // ✅ ही line add करा

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
import paymentRoutes from './routes/paymentLink.js';
import transactionRoutes from './routes/transactionRoutes.js';
import agreementRoutes from './routes/agreementRoutes.js';
import businessSizeRoutes from './routes/businessSizeRoutes.js';
import cryptoWalletRoutes from './routes/cryptoWalletRoutes.js'; // Add this import
import featureRoutes from './routes/featureRoutes.js'; // Add this import
import industryRoutes from './routes/industryRoutes.js'; // ADD THIS LINE
import integrationMethodRoutes from './routes/integrationMethodRoutes.js'; // Add this line
import paymentMethodRoutes from './routes/paymentMethodRoutes.js'; // Add this line
import paymentOptionRoutes from './routes/paymentOptionRoutes.js'; // Add this line
import pluginRoutes from './routes/pluginRoutes.js'; // Add this line
import solutionRoutes from './routes/solutionRoutes.js'; // Add this line
import requiredFieldRoutes from './routes/requiredFieldRoutes.js'; // ADD THIS LINE
import dashboardRoutes from './routes/dashboardRoutes.js'; // Add this line4
import riskManagementRoutes from './routes/riskManagementRoutes.js';
import payoutSettlementRoutes from './routes/payoutSettlementRoutes.js';
import payoutTransactionRoutes from './routes/payoutTransactionRoutes.js'; // ADD THIS LINE

dotenv.config();

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection

connectDB();

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
app.use('/api/payment', paymentRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/business-sizes', businessSizeRoutes);
app.use('/api/crypto-wallets', cryptoWalletRoutes); // Make sure this line is added
app.use('/api/features', featureRoutes); // Add this line
app.use('/api/industries', industryRoutes); // ADD THIS LINE
app.use('/api/integration-methods', integrationMethodRoutes); // Add this line
app.use('/api/payment-methods', paymentMethodRoutes); // Add this line for your new routes
app.use('/api/payment-options', paymentOptionRoutes); // New route for payment options
app.use('/api/plugins', pluginRoutes); // Add this line
app.use('/api/solutions', solutionRoutes); // Add this line for your new routes
app.use('/api/required-fields', requiredFieldRoutes); // ADD THIS LINE
app.use('/api/dashboard', dashboardRoutes); // Add this line
app.use('/api/risk-management', riskManagementRoutes);
app.use('/api/payout-settlements', payoutSettlementRoutes); // ADD THIS LINE
app.use('/api/payout-transactions', payoutTransactionRoutes); // ADD THIS LINE

// Basic root route
app.get('/', (req, res) => {
    res.send('Welcome to the PG Admin API!');
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));