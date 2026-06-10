const cron = require('node-cron');
const zohoService = require('../services/zohoService');
const { getSapQuoteDetails } = require('../services/sapService');
const { mapSapDataToZoho, mapSapItemToZohoSubformItem } = require('../utils/sapMapper');
const ErrorLog = require('../models/errorLogModel');
const { getCurrentIsoDateTimeForZoho } = require('../utils/dateUtils');
const logger = require('../utils/logger');

const sapOfferCodes = [
  '101',
  '133'
];

const runWeeklyReconciliation = async () => {
    logger.info(`\n🔄 [CRON] Starting Weekly SAP-Zoho Reconciliation: ${new Date().toISOString()}`);

    try {
        let dealsToSync = [];
        let offset = 0;
        const limit = 200;
        let hasMore = true;

        while (hasMore) {
            const coqlQuery = `select id, Deal_Name, SAP_Offer_Code, Stage from Deals where SAP_Offer_Code in (${sapOfferCodes.map(code => `'${code}'`).join(',')}) limit ${limit} offset ${offset}`;
            // const coqlQuery = `select id, Deal_Name, SAP_Offer_Code, Stage from Deals where SAP_Offer_Code is not null limit ${limit} offset ${offset}`;
            const chunk = await zohoService.runCoqlQuery(coqlQuery);
            dealsToSync = dealsToSync.concat(chunk);
            
            if (chunk.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
            }
        }

        logger.info(`📊 Found ${dealsToSync.length} Deals in Zoho linked to an SAP Quote.`);

        let successCount = 0;
        let failCount = 0;

        for (const deal of dealsToSync) {
            const sapQuoteId = deal.SAP_Offer_Code;

            logger.info(`\nReconciling Deal ${deal.id} (SAP Quote: ${sapQuoteId})...`);

            const rawSapQuote = await getSapQuoteDetails(sapQuoteId);

            if (!rawSapQuote) {
                logger.warn(`⚠️ SAP Quote ${sapQuoteId} not found in SAP ByDesign. Skipping.`);
                failCount++;
                continue;
            }

            const zohoMappedFields = mapSapDataToZoho(rawSapQuote);

            const sapStatusCode = rawSapQuote.Status?.CustomerQuoteResultStatusCode;
            let zohoStatusUpdate = "OK";
            if (sapStatusCode === "3") zohoStatusUpdate = "Completed";
            if (sapStatusCode === "4") zohoStatusUpdate = "Lost";
            if (sapStatusCode === "5") zohoStatusUpdate = "Canceled";

            // --- PRODUCT LINES SYNC ---
            // 1. Fetch full deal data to get existing subform
            const fullDealData = await zohoService.getRecord('Deals', deal.id);
            const existingSubform = fullDealData.Product_Details || [];

            // 2. Extract SAP Items
            const sapItems = rawSapQuote.Item ? (Array.isArray(rawSapQuote.Item) ? rawSapQuote.Item : [rawSapQuote.Item]) : [];
            const newSubformData = [];

            for (const sapItem of sapItems) {
                const mappedSapItem = mapSapItemToZohoSubformItem(sapItem);

                // Match with existing row to preserve custom fields like Notes
                const existingRowIndex = existingSubform.findIndex(r => {
                    const rCode = typeof r.Product_Code === 'object' && r.Product_Code !== null ? r.Product_Code.name : r.Product_Code;
                    return r.Activity_description === mappedSapItem.Activity_description || rCode === mappedSapItem.Product_Code;
                });

                let existingRow = null;
                if (existingRowIndex > -1) {
                    existingRow = existingSubform.splice(existingRowIndex, 1)[0];
                }

                let productId = existingRow?.Product_Code?.id;

                // If not linked yet, search product by code
                if (!productId && mappedSapItem.Product_Code) {
                    const products = await zohoService.searchProductsByCode(mappedSapItem.Product_Code);
                    if (products.length > 0) productId = products[0].id;
                }

                newSubformData.push({
                    ...(existingRow || {}), // retains `id` and Zoho-only fields
                    Product_Code: productId ? { id: productId } : null,
                    Activity_description: mappedSapItem.Activity_description,
                    Quantity: mappedSapItem.Quantity,
                    Unidad_de_medida: mappedSapItem.Unit,
                    Unit_Price: mappedSapItem.Unit_Price,
                    Discount: mappedSapItem.Discount,
                    Optional: mappedSapItem.Optional
                });
            }

            try {
                await zohoService.updateDealField(deal.id, {
                    SAP_Shipment_Status: zohoStatusUpdate,
                    SAP_Shipment_Date: getCurrentIsoDateTimeForZoho(),
                    Product_Details: newSubformData,
                    ...zohoMappedFields
                });

                logger.info(`✅ Deal ${deal.id} successfully updated from SAP.`);
                successCount++;

            } catch (zohoErr) {
                logger.error(`❌ Failed to update Zoho Deal ${deal.id}: ${zohoErr.message}`);
                failCount++;
            }
        }

        logger.info(`\n🏁 [CRON] Reconciliation Complete. Success: ${successCount}, Failed: ${failCount}`);

        await ErrorLog.create({
            dealId: "SYSTEM", logType: 'INFO', stage: 'WEEKLY_RECONCILIATION',
            messages: [`Reconciliation finished. Updated: ${successCount}, Failed: ${failCount}`]
        });

    } catch (error) {
        logger.error(`CRITICAL CRON ERROR: ${error.message}`);
    }
};

// // To run weekly on Sundays at 2:00 AM
// cron.schedule('0 2 * * 0', () => {
//     runWeeklyReconciliation();
// });

// To run daily at 2:00 AM
// cron.schedule('0 2 * * *', () => {
//     runWeeklyReconciliation();
// });

module.exports = { runWeeklyReconciliation };

