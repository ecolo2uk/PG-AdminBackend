import PayoutSettlement from '../models/PayoutSettlement.js';
import User from '../models/User.js';
import asyncHandler from 'express-async-handler';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';

// Placeholder for actual admin authorization middleware
// In a real app, this would be integrated with JWT verification etc.
const protectAndAuthorizeAdmin = (req, res, next) => {
    // IMPORTANT: Replace this with your actual authentication and authorization logic
    // This is a minimal placeholder.
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        // For testing, temporarily bypass. REMOVE IN PRODUCTION!
        console.warn("ADMIN AUTHORIZATION SKIPPED. Ensure req.user is set in real app.");
        req.user = { id: new mongoose.Types.ObjectId(), role: 'admin', firstname: 'Test', lastname: 'Admin' }; // Mock admin user
        next();
        // return res.status(403).json({ message: 'Not authorized, admin access required' });
    }
};

// @desc    Get merchants with unsettleBalance for settlement selection (and filter dropdown)
// @route   GET /api/payout-settlements/merchants
// @access  Admin
export const getMerchantsForSettlement = asyncHandler(async (req, res) => {
    // protectAndAuthorizeAdmin(req, res, async () => { // Apply authorization if needed
        const merchants = await User.find({ role: 'merchant' }) // Get all merchants, not just those with unsettle balance > 0
                                   .select('_id firstname lastname email unsettleBalance company mid'); // Also select 'mid' for potential display/filtering

        res.status(200).json(merchants);
    // });
});

// @desc    Initiate a new payout settlement
// @route   POST /api/payout-settlements/
// @access  Admin
export const createPayoutSettlement = asyncHandler(async (req, res) => {
    protectAndAuthorizeAdmin(req, res, async () => {
        // Frontend now sends selectedMerchantIds and merchantBalances,
        // backend calculates the total settlementAmount
        const { selectedMerchantIds, merchantBalances } = req.body;

        if (!Array.isArray(selectedMerchantIds) || selectedMerchantIds.length === 0) {
            return res.status(400).json({ message: 'At least one merchant must be selected for settlement.' });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const merchantsDataForSettlement = [];
            let totalActualSettledAmount = 0; // The sum calculated by the backend

            for (const merchantId of selectedMerchantIds) {
                const merchant = await User.findOne({ _id: merchantId, role: 'merchant' }).session(session);

                if (!merchant) {
                    throw new Error(`Merchant with ID ${merchantId} not found or is not a merchant.`);
                }

                // Get the amount specific to this merchant from the frontend payload
                const amountToSettleForThisMerchant = parseFloat(merchantBalances[merchantId] || 0);

                if (isNaN(amountToSettleForThisMerchant) || amountToSettleForThisMerchant <= 0) {
                    // Skip if no valid positive amount specified for this merchant
                    // This allows partial settlement or if a merchant's amount was zeroed out
                    continue;
                }

                if (amountToSettleForThisMerchant > merchant.unsettleBalance) {
                    throw new Error(`Cannot settle ${amountToSettleForThisMerchant.toFixed(2)} for ${merchant.company || merchant.firstname}. Unsettled balance is ${merchant.unsettleBalance.toFixed(2)}.`);
                }

                merchantsDataForSettlement.push({
                    merchantId: merchant._id,
                    merchantName: merchant.company || `${merchant.firstname} ${merchant.lastname}`,
                    merchantEmail: merchant.email,
                    settledBalance: amountToSettleForThisMerchant,
                });

                // Update merchant's unsettleBalance
                merchant.unsettleBalance -= amountToSettleForThisMerchant;
                await merchant.save({ session });

                totalActualSettledAmount += amountToSettleForThisMerchant;
            }

            if (merchantsDataForSettlement.length === 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({ message: 'No valid settlement amounts provided for selected merchants.' });
            }

            // Create the new payout settlement record
            const newSettlement = new PayoutSettlement({
                settlementAmount: totalActualSettledAmount, // Use the actual sum calculated by the backend
                settledBy: req.user ? req.user.id : null, // Populate if `req.user` is available from auth middleware
                merchantsSettled: merchantsDataForSettlement,
                status: 'completed'
            });

            await newSettlement.save({ session });

            await session.commitTransaction();
            session.endSession();

            res.status(201).json({ message: 'Payout settlement created successfully', settlement: newSettlement });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error("Error creating payout settlement:", error);
            res.status(500).json({ message: 'Failed to create payout settlement', error: error.message });
        }
    });
});


// @desc    Get merchant settlement history with filtering and pagination
// @route   GET /api/payout-settlements/history
// @access  Admin
export const getSettlementHistory = asyncHandler(async (req, res) => {
    protectAndAuthorizeAdmin(req, res, async () => {
        const { page = 1, limit = 10, merchantId, startDate, endDate, export: exportToExcel } = req.query;

        const query = {};

        if (merchantId && merchantId !== 'all') { // Added 'all' option for dropdown
            query['merchantsSettled.merchantId'] = new mongoose.Types.ObjectId(merchantId);
        }

        if (startDate || endDate) {
            query.settlementDate = {};
            if (startDate) {
                // Set start of day
                const startOfDay = new Date(startDate);
                startOfDay.setHours(0, 0, 0, 0);
                query.settlementDate.$gte = startOfDay;
            }
            if (endDate) {
                // Set end of day
                const endOfDay = new Date(endDate);
                endOfDay.setHours(23, 59, 59, 999);
                query.settlementDate.$lte = endOfDay;
            }
        }

        const options = {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            sort: { settlementDate: -1 },
            populate: { // Populate the merchant details within the merchantsSettled array
                path: 'merchantsSettled.merchantId',
                select: 'firstname lastname company email mid' // More comprehensive selection
            }
        };

        if (exportToExcel === 'true') {
            const allSettlements = await PayoutSettlement.find(query)
                .sort(options.sort)
                .populate(options.populate); // Ensure populate happens for export too

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Merchant Settlement History');

            worksheet.columns = [
                { header: 'Settlement ID', key: 'settlementId', width: 30 },
                { header: 'Merchant MID', key: 'merchantMid', width: 20 },
                { header: 'Merchant Name', key: 'merchantName', width: 30 },
                { header: 'Merchant Email', key: 'merchantEmail', width: 30 },
                { header: 'Settled Amount (For This Merchant)', key: 'settledAmountMerchant', width: 30 },
                { header: 'Total Batch Settlement Amount', key: 'totalSettlementAmount', width: 30 },
                { header: 'Settlement Date', key: 'settlementDate', width: 25 },
                { header: 'Status', key: 'status', width: 15 },
            ];

            // Add headers styling
            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' } // Light grey background
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });


            allSettlements.forEach(settlement => {
                settlement.merchantsSettled.forEach(merchantData => {
                    const merchantRef = merchantData.merchantId; // This is the populated User object
                    worksheet.addRow({
                        settlementId: settlement._id.toString(),
                        merchantMid: merchantRef?.mid || 'N/A', // Access populated mid
                        merchantName: merchantRef?.company || `${merchantRef?.firstname} ${merchantRef?.lastname}` || merchantData.merchantName || 'N/A',
                        merchantEmail: merchantRef?.email || merchantData.merchantEmail || 'N/A',
                        settledAmountMerchant: merchantData.settledBalance.toFixed(2),
                        totalSettlementAmount: settlement.settlementAmount.toFixed(2),
                        settlementDate: new Date(settlement.settlementDate).toLocaleString(),
                        status: settlement.status,
                    });
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=' + 'MerchantSettlementHistory.xlsx');

            await workbook.xlsx.write(res);
            return res.end();
        }

        const settlements = await PayoutSettlement.paginate(query, options);

        // Transform data to simplify for frontend table display
        const transformedSettlements = settlements.docs.map(settlement => ({
            _id: settlement._id,
            settlementAmount: settlement.settlementAmount, // Total batch amount
            settlementDate: settlement.settlementDate,
            // For the main table, we'll pick the first merchant as representative
            // If you need each merchant to be a separate row, client-side or
            // backend `$unwind` aggregation would be needed.
            merchantName: settlement.merchantsSettled[0]?.merchantId?.company || `${settlement.merchantsSettled[0]?.merchantId?.firstname} ${settlement.merchantsSettled[0]?.merchantId?.lastname}` || settlement.merchantsSettled[0]?.merchantName || 'N/A',
            // Keep original merchantsSettled array if frontend wants to iterate
            merchantsSettled: settlement.merchantsSettled.map(m => ({
                merchantId: m.merchantId?._id,
                merchantName: m.merchantId?.company || `${m.merchantId?.firstname} ${m.merchantId?.lastname}` || m.merchantName,
                merchantEmail: m.merchantId?.email || m.merchantEmail,
                settledBalance: m.settledBalance,
            })),
            status: settlement.status,
        }));


        res.status(200).json({
            settlements: transformedSettlements,
            totalPages: settlements.totalPages,
            currentPage: settlements.page,
            totalResults: settlements.totalDocs,
            limit: settlements.limit,
        });
    });
});