// seed.js
import mongoose from 'mongoose';
import Module from './models/Module.js';
import Submodule from './models/Submodule.js';
import dotenv from 'dotenv';

dotenv.config();

const modulesData = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    url: '/dashboard/default',
    submodules: []
  },
  {
    id: 'usermanagement',
    title: 'User Management',
    url: null,
    submodules: [
      { id: 'adminuser', title: 'Admin User', url: '/usermanagement/admin-users' },
      { id: 'merchantuser', title: 'Merchant User', url: '/usermanagement/merchant-user' },
      { id: 'pspuser', title: 'PSP User', url: '/usermanagement/psp-user' },
      { id: 'ReferralUser', title: 'Referral User', url: '/usermanagement/referral-user' },
      { id: 'rolepermission', title: 'Roles and Permissions', url: '/usermanagement/RolesPage' },
    ]
  },
  {
    id: 'pendingapproval',
    title: 'Pending For Approval',
    url: null,
    submodules: [
      { id: 'pendingapproval_item', title: 'Pending Approval', url: '/approval/pending-approval' },
    ]
  },
  {
    id: 'transaction',
    title: 'All Transactions',
    url: null,
    submodules: [
      { id: 'upi', title: 'UPI', url: '/transaction/upi-transaction' },
      { id: 'card', title: 'Card', url: '/transaction/card-transaction' },
    ]
  },
  {
    id: 'payouts',
    title: 'Payouts',
    url: null,
    submodules: [
      { id: 'payouttransaction', title: 'Payout Transaction', url: '/payouts/payout-transaction' },
      { id: 'payout-merchant', title: 'Payout Merchant', url: '/payouts/payout-merchant' },
    ]
  },
  {
    id: 'settlements',
    title: 'Settlements',
    url: null,
    submodules: [
      { id: 'settlement', title: 'Settlement', url: '/settlements/settlement' },
      { id: 'settlement-history', title: 'Settlement History', url: '/settlements/settlement-history' },
      { id: 'bank-settlement', title: 'Bank Settlement', url: '/settlements/bank-settlement' },
      { id: 'settlementcalculator', title: 'Settlement Calculator', url: '/settlements/settlementcalculator' },
      { id: 'settlement-calculatorV2', title: 'Settlement Calculator V2', url: '/settlements/settlement-calculatorV2' },
      { id: 'rolling-reserve', title: 'Rolling Reserve', url: '/settlements/rolling-reserve' },
      { id: 'merchant-fees', title: 'Merchant Fees', url: '/settlements/merchant-fees' },
      { id: 'auto-settlement', title: 'Auto Settlement', url: '/settlements/auto-settlement' },
    ]
  },
  {
    id: 'connector',
    title: 'Connector',
    url: null,
    submodules: [
      { id: 'connectortransaction', title: 'Connector Transaction', url: '/connector/list' },
    ]
  },
  {
    id: 'reports',
    title: 'Reports',
    url: null,
    submodules: [
      { id: 'Admin-profit-loss', title: 'Admin Profit', url: '/reports/Admin-profit-loss' },
      { id: 'merchant-turnover', title: 'Merchant Turnover', url: '/reports/merchant-turnover' },
      { id: 'merchant-transactions', title: 'Merchant Transactions', url: '/reports/merchant-transactions' },
      { id: 'MID-summary', title: 'MID Summary', url: '/reports/MID-summary' },
      { id: 'MID-settlement', title: 'MID Settlement', url: '/reports/MID-settlement' },
      { id: 'transaction-summary', title: 'Transaction Summary', url: '/reports/transaction-summary' },
      { id: 'transaction-paying-response', title: 'Transaction Paying Response', url: '/reports/transaction-paying-response' },
      { id: 'transaction-payout-summary', title: 'Payout MID Summary', url: '/reports/transaction-payout-summary' },
      { id: 'transaction-payout-response', title: 'Transaction Payout Response', url: '/reports/transaction-payout-response' },
    ]
  },
  {
    id: 'payments',
    title: 'Payments',
    url: null,
    submodules: [
      { id: 'payments_item', title: 'Payments', url: '/payments/payments' },
    ]
  },
  {
    id: 'invoices',
    title: 'Invoices',
    url: null,
    submodules: [
      { id: 'invoices_item', title: 'Invoices', url: '/invoices/invoices' },
    ]
  },
  {
    id: 'expenses',
    title: 'Expenses',
    url: null,
    submodules: [
      { id: 'expense', title: 'Expense', url: '/expenses/expenses' },
    ]
  },
  {
    id: 'developer',
    title: 'Developer',
    url: null,
    submodules: [
      { id: 'developer_item', title: 'System Logs', url: '/developer/developer' },
    ]
  },
  {
    id: 'riskmanagement',
    title: 'Risk Management',
    url: null,
    submodules: [
      { id: 'riskmanagement_item', title: 'Risk Management', url: '/riskmanagement/riskmanagement' },
    ]
  },
  {
    id: 'notification',
    title: 'Notifications',
    url: null,
    submodules: [
      { id: 'notification_item', title: 'Notifications', url: '/notification/notification' },
    ]
  },
  {
    id: 'master',
    title: 'Master',
    url: null,
    submodules: [
      { id: 'agreement', title: 'Agreement', url: '/master/agreement' },
      { id: 'business', title: 'Business Sizes', url: '/master/business' },
      { id: 'crypto', title: 'Crypto Wallets', url: '/master/crypto' },
      { id: 'feature', title: 'Feature', url: '/master/feature' },
      { id: 'Industry', title: 'Industry', url: '/master/industries' },
      { id: 'integration', title: 'Integration', url: '/master/integration' },
      { id: 'payment-method', title: 'Payment Method', url: '/master/payment-method' },
      { id: 'payment-option', title: 'Payment Option', url: '/master/payment-option' },
      { id: 'plugin', title: 'Plugin', url: '/master/plugin' },
      { id: 'solution', title: 'Solution', url: '/master/solution' },
      { id: 'required', title: 'Required', url: '/master/required' },
    ]
  },
  {
    id: 'support',
    title: 'Support',
    url: null,
    submodules: [
      { id: 'support_item', title: 'Ticket', url: '/support/support' },
    ]
  },
  {
    id: 'other',
    title: 'Other',
    url: null,
    submodules: [
      { id: 'refund', title: 'Refund Transactions', url: '/other/refund' },
      { id: 'chargeback', title: 'Chargeback Transactions', url: '/other/chargeback' },
      { id: 'achieve', title: 'All Archived Transactions', url: '/other/achieve' },
      { id: 'tests', title: 'Tests', url: '/other/tests' },
    ]
  },
  {
    id: 'utilities',
    title: 'Utilities',
    url: null,
    submodules: [
      { id: 'util-typography', title: 'Typography', url: '/typography' },
      { id: 'util-color', title: 'Color', url: '/color' },
      { id: 'util-shadow', title: 'Shadow', url: '/shadow' }
    ]
  },
  {
    id: 'authentication',
    title: 'Authentication',
    url: null,
    submodules: [
      { id: 'login1', title: 'Login', url: '/login' },
      { id: 'register1', title: 'Register', url: '/register' }
    ]
  }
];

async function seedDB() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('MongoDB connected for seeding.');

  try {
    // Attempt to drop the 'name_1' index from modules collection
    try {
      await mongoose.connection.collection('modules').dropIndex('name_1');
      console.log('Successfully dropped old "name_1" index from modules collection.');
    } catch (indexError) {
      if (indexError.code === 27) { // 27 is the error code for "index not found"
        console.log('Old "name_1" index not found on modules, skipping drop.');
      } else {
        console.warn('Warning: Could not drop "name_1" index from modules:', indexError.message);
      }
    }

    // Attempt to drop the 'originalId_1' index from submodules collection
    try {
      await mongoose.connection.collection('submodules').dropIndex('originalId_1');
      console.log('Successfully dropped old "originalId_1" index from submodules collection.');
    } catch (indexError) {
      if (indexError.code === 27) { // 27 is the error code for "index not found"
        console.log('Old "originalId_1" index not found on submodules, skipping drop.');
      } else {
        console.warn('Warning: Could not drop "originalId_1" index from submodules:', indexError.message);
      }
    }

    // --- ADDED: Attempt to drop the problematic 'moduleId_1_name_1' index ---
    try {
      await mongoose.connection.collection('submodules').dropIndex('moduleId_1_name_1');
      console.log('Successfully dropped old "moduleId_1_name_1" index from submodules collection.');
    } catch (indexError) {
      if (indexError.code === 27) {
        console.log('Old "moduleId_1_name_1" index not found on submodules, skipping drop.');
      } else {
        console.warn('Warning: Could not drop "moduleId_1_name_1" index from submodules:', indexError.message);
      }
    }
    // --- END ADDED SECTION ---

    console.log('Clearing existing Modules and Submodules...');
    await Module.deleteMany({});
    await Submodule.deleteMany({});
    console.log('Existing Modules and Submodules cleared.');

    for (const moduleData of modulesData) {
      const newModule = new Module({
        moduleId: moduleData.id,
        title: moduleData.title,
        url: moduleData.url,
      });
      await newModule.save();
      console.log(`Module "${newModule.title}" saved.`);

      for (const submoduleData of moduleData.submodules) {
        const newSubmodule = new Submodule({
          submoduleId: submoduleData.id, // This is your intended unique ID
          title: submoduleData.title,
          url: submoduleData.url,
          moduleId: newModule._id,
        });
        await newSubmodule.save();
        console.log(`  Submodule "${newSubmodule.title}" saved.`);
      }
    }
    console.log('Database seeding complete!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

seedDB();