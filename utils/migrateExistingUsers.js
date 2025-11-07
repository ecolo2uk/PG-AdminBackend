// utils/migrateExistingUsers.js
import User from '../models/User.js';
import Merchant from '../models/Merchant.js';

export const migrateExistingUsersToMerchants = async () => {
  try {
    console.log('🔄 Migrating existing users to merchants table...');
    
    const merchantUsers = await User.find({ role: 'merchant' });
    console.log(`📊 Found ${merchantUsers.length} merchant users to migrate`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const user of merchantUsers) {
      try {
        // Check if merchant already exists
        const existingMerchant = await Merchant.findOne({ userId: user._id });
        
        if (!existingMerchant) {
          const newMerchant = new Merchant({
            userId: user._id,
            merchantName: user.company || `${user.firstname} ${user.lastname}`,
            company: user.company || '',
            email: user.email,
            contact: user.contact || '',
            mid: user.mid || `M${Date.now()}${Math.floor(Math.random() * 1000)}`,
            availableBalance: user.balance || 0,
            unsettledBalance: user.unsettleBalance || 0,
            totalCredits: 0,
            totalDebits: 0,
            netEarnings: 0,
            status: user.status || 'Active',
            recentTransactions: [],
            transactionSummary: {
              today: { credits: 0, debits: 0, count: 0 },
              last7Days: { credits: 0, debits: 0, count: 0 },
              last30Days: { credits: 0, debits: 0, count: 0 }
            }
          });

          await newMerchant.save();
          
          // Update user with merchant reference
          user.merchantRef = newMerchant._id;
          await user.save();
          
          createdCount++;
          console.log(`✅ Created merchant for: ${user.email}`);
        } else {
          skippedCount++;
          console.log(`⏭️ Already exists: ${user.email}`);
        }
      } catch (userError) {
        console.error(`❌ Error migrating user ${user.email}:`, userError.message);
      }
    }

    console.log(`🎉 Migration completed! Created: ${createdCount}, Skipped: ${skippedCount}`);
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
};