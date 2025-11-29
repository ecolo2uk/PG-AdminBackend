import PayoutSettlement from '../models/PayoutSettlement.js';
import User from '../models/User.js';
import asyncHandler from 'express-async-handler';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';

// Placeholder for actual admin authorization middleware
const protectAndAuthorizeAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        console.warn("ADMIN AUTHORIZATION SKIPPED. Ensure req.user is set in real app.");
        req.user = { id: new mongoose.Types.ObjectId(), role: 'admin', firstname: 'Test', lastname: 'Admin' };
        next();
    }
};

// @desc    Get merchants with unsettleBalance for settlement selection
// @route   GET /api/payout-settlements/merchants
// @access  Admin
export const getMerchantsForSettlement = asyncHandler(async (req, res) => {
    const merchants = await User.find({ role: 'merchant' })
                               .select('_id firstname lastname email unsettleBalance company mid')
                               .sort({ firstname: 1 });

    res.status(200).json({
        success: true,
        data: merchants
    });
});

// @desc    Initiate a new payout settlement
// @route   POST /api/payout-settlements/
// @access  Admin
export const createPayoutSettlement = asyncHandler(async (req, res) => {
    protectAndAuthorizeAdmin(req, res, async () => {
        const { selectedMerchantIds, merchantBalances } = req.body;

        if (!Array.isArray(selectedMerchantIds) || selectedMerchantIds.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: 'At least one merchant must be selected for settlement.' 
            });
        }

        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const merchantsDataForSettlement = [];
            let totalActualSettledAmount = 0;

            for (const merchantId of selectedMerchantIds) {
                const merchant = await User.findOne({ _id: merchantId, role: 'merchant' }).session(session);

                if (!merchant) {
                    throw new Error(`Merchant with ID ${merchantId} not found or is not a merchant.`);
                }

                const amountToSettleForThisMerchant = parseFloat(merchantBalances[merchantId] || 0);

                if (isNaN(amountToSettleForThisMerchant) || amountToSettleForThisMerchant <= 0) {
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
                return res.status(400).json({ 
                    success: false,
                    message: 'No valid settlement amounts provided for selected merchants.' 
                });
            }

            // Create the new payout settlement record
            const newSettlement = new PayoutSettlement({
                settlementAmount: totalActualSettledAmount,
                settledBy: req.user ? req.user.id : null,
                merchantsSettled: merchantsDataForSettlement,
                status: 'completed'
            });

            await newSettlement.save({ session });
            await session.commitTransaction();
            session.endSession();

            res.status(201).json({ 
                success: true,
                message: 'Payout settlement created successfully', 
                data: newSettlement 
            });

        } catch (error) {
            await session.abortTransaction();
            session.endSession();
            console.error("Error creating payout settlement:", error);
            res.status(500).json({ 
                success: false,
                message: 'Failed to create payout settlement', 
                error: error.message 
            });
        }
    });
});

// @desc    Get merchant settlement history with filtering and pagination
// @route   GET /api/payout-settlements/history
// @access  Admin
export const getSettlementHistory = asyncHandler(async (req, res) => {
    protectAndAuthorizeAdmin(req, res, async () => {
        try {
            const { 
                page = 1, 
                limit = 10, 
                merchantId, 
                startDate, 
                endDate, 
                export: exportToExcel 
            } = req.query;

            const query = {};

            // Merchant filter
            if (merchantId && merchantId !== 'all') {
                query['merchantsSettled.merchantId'] = new mongoose.Types.ObjectId(merchantId);
            }

            // Date range filter
            if (startDate || endDate) {
                query.settlementDate = {};
                if (startDate) {
                    const startOfDay = new Date(startDate);
                    startOfDay.setHours(0, 0, 0, 0);
                    query.settlementDate.$gte = startOfDay;
                }
                if (endDate) {
                    const endOfDay = new Date(endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    query.settlementDate.$lte = endOfDay;
                }
            }

            // Export functionality
            if (exportToExcel === 'true') {
                const allSettlements = await PayoutSettlement.find(query)
                    .populate('merchantsSettled.merchantId', 'firstname lastname company email mid')
                    .sort({ settlementDate: -1 });

                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Merchant Settlement History');

                // Define columns
                worksheet.columns = [
                    { header: 'Settlement ID', key: 'settlementId', width: 30 },
                    { header: 'Merchant MID', key: 'merchantMid', width: 20 },
                    { header: 'Merchant Name', key: 'merchantName', width: 30 },
                    { header: 'Merchant Email', key: 'merchantEmail', width: 30 },
                    { header: 'Settled Amount', key: 'settledAmountMerchant', width: 25 },
                    { header: 'Total Settlement Amount', key: 'totalSettlementAmount', width: 25 },
                    { header: 'Settlement Date', key: 'settlementDate', width: 25 },
                    { header: 'Status', key: 'status', width: 15 },
                ];

                // Style headers
                worksheet.getRow(1).eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE0E0E0' }
                    };
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });

                // Add data rows
                allSettlements.forEach(settlement => {
                    settlement.merchantsSettled.forEach(merchantData => {
                        const merchantRef = merchantData.merchantId;
                        worksheet.addRow({
                            settlementId: settlement._id.toString(),
                            merchantMid: merchantRef?.mid || 'N/A',
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
                res.setHeader('Content-Disposition', `attachment; filename=MerchantSettlementHistory_${Date.now()}.xlsx`);

                await workbook.xlsx.write(res);
                return res.end();
            }

            // Paginated response
            const options = {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                sort: { settlementDate: -1 },
                populate: {
                    path: 'merchantsSettled.merchantId',
                    select: 'firstname lastname company email mid'
                }
            };

            const settlements = await PayoutSettlement.paginate(query, options);

            // Transform data for frontend
            const transformedSettlements = settlements.docs.map(settlement => ({
                _id: settlement._id,
                settlementAmount: settlement.settlementAmount,
                settlementDate: settlement.settlementDate,
                merchantName: settlement.merchantsSettled[0]?.merchantId?.company || 
                             `${settlement.merchantsSettled[0]?.merchantId?.firstname} ${settlement.merchantsSettled[0]?.merchantId?.lastname}` || 
                             settlement.merchantsSettled[0]?.merchantName || 'N/A',
                merchantsSettled: settlement.merchantsSettled.map(m => ({
                    merchantId: m.merchantId?._id,
                    merchantName: m.merchantId?.company || `${m.merchantId?.firstname} ${m.merchantId?.lastname}` || m.merchantName,
                    merchantEmail: m.merchantId?.email || m.merchantEmail,
                    settledBalance: m.settledBalance,
                })),
                status: settlement.status,
            }));

            res.status(200).json({
                success: true,
                data: transformedSettlements,
                pagination: {
                    totalPages: settlements.totalPages,
                    currentPage: settlements.page,
                    totalResults: settlements.totalDocs,
                    limit: settlements.limit,
                }
            });

        } catch (error) {
            console.error("Error fetching settlement history:", error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch settlement history',
                error: error.message
            });
        }
    });
});

// @desc    Export settlement history
// @route   GET /api/payout-settlements/export
// @access  Admin
export const exportSettlementHistory = asyncHandler(async (req, res) => {
    protectAndAuthorizeAdmin(req, res, async () => {
        try {
            const { merchantId, startDate, endDate } = req.query;

            const query = {};

            if (merchantId && merchantId !== 'all') {
                query['merchantsSettled.merchantId'] = new mongoose.Types.ObjectId(merchantId);
            }

            if (startDate || endDate) {
                query.settlementDate = {};
                if (startDate) {
                    const startOfDay = new Date(startDate);
                    startOfDay.setHours(0, 0, 0, 0);
                    query.settlementDate.$gte = startOfDay;
                }
                if (endDate) {
                    const endOfDay = new Date(endDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    query.settlementDate.$lte = endOfDay;
                }
            }

            const allSettlements = await PayoutSettlement.find(query)
                .populate('merchantsSettled.merchantId', 'firstname lastname company email mid')
                .sort({ settlementDate: -1 });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Merchant Settlement History');

            worksheet.columns = [
                { header: 'Settlement ID', key: 'settlementId', width: 30 },
                { header: 'Merchant Name', key: 'merchantName', width: 30 },
                { header: 'Merchant Email', key: 'merchantEmail', width: 30 },
                { header: 'Settled Amount', key: 'settledAmount', width: 20 },
                { header: 'Total Settlement', key: 'totalSettlement', width: 20 },
                { header: 'Settlement Date', key: 'settlementDate', width: 25 },
                { header: 'Status', key: 'status', width: 15 },
            ];

            // Style headers
            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE6E6FA' }
                };
            });

            // Add data
            allSettlements.forEach(settlement => {
                settlement.merchantsSettled.forEach(merchantSettlement => {
                    worksheet.addRow({
                        settlementId: settlement._id,
                        merchantName: merchantSettlement.merchantName,
                        merchantEmail: merchantSettlement.merchantEmail,
                        settledAmount: parseFloat(merchantSettlement.settledBalance || 0).toFixed(2),
                        totalSettlement: parseFloat(settlement.settlementAmount || 0).toFixed(2),
                        settlementDate: new Date(settlement.settlementDate).toLocaleDateString(),
                        status: settlement.status
                    });
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=merchant_settlement_history_${Date.now()}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('Export settlement history error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to export settlement history'
            });
        }
    });
});