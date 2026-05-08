const cron = require('node-cron');
const zohoService = require('../services/zohoService');
const { getSapQuoteDetails } = require('../services/sapService');
const { mapSapDataToZoho, mapSapItemToZohoSubformItem } = require('../utils/sapMapper');
const ErrorLog = require('../models/errorLogModel');
const { getCurrentIsoDateTimeForZoho } = require('../utils/dateUtils');

const runWeeklyReconciliation = async () => {
    console.log(`\n🔄 [CRON] Starting Weekly SAP-Zoho Reconciliation: ${new Date().toISOString()}`);

    try {
        const coqlQuery = "select id, Deal_Name, SAP_Offer_Code, Stage from Deals where SAP_Offer_Code = '11006'";
        const dealsToSync = await zohoService.runCoqlQuery(coqlQuery);
        console.log(`📊 Found ${dealsToSync.length} Deals in Zoho linked to an SAP Quote.`);

        let successCount = 0;
        let failCount = 0;

        for (const deal of dealsToSync) {
            const sapQuoteId = deal.SAP_Offer_Code;

            console.log(`\nReconciling Deal ${deal.id} (SAP Quote: ${sapQuoteId})...`);

            const rawSapQuote = await getSapQuoteDetails(sapQuoteId);

            if (!rawSapQuote) {
                console.warn(`⚠️ SAP Quote ${sapQuoteId} not found in SAP ByDesign. Skipping.`);
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
                const existingRow = existingSubform.find(r => r.Activity_description === mappedSapItem.Activity_description || r.Product_Code === mappedSapItem.Product_Code);

                let productId = existingRow?.Product_Name?.id;

                // If not linked yet, search product by name
                if (!productId && mappedSapItem.Activity_description) {
                    const products = await zohoService.searchProductsByName(mappedSapItem.Activity_description);
                    if (products.length > 0) productId = products[0].id;
                }

                newSubformData.push({
                    ...(existingRow || {}), // retains `id` and Zoho-only fields
                    Product_Name: productId ? { id: productId } : null,
                    Product_Code: mappedSapItem.Product_Code,
                    Activity_description: mappedSapItem.Activity_description,
                    Quantity: mappedSapItem.Quantity,
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

                console.log(`✅ Deal ${deal.id} successfully updated from SAP.`);
                successCount++;

            } catch (zohoErr) {
                console.error(`❌ Failed to update Zoho Deal ${deal.id}:`, zohoErr.message);
                failCount++;
            }
        }

        console.log(`\n🏁 [CRON] Reconciliation Complete. Success: ${successCount}, Failed: ${failCount}`);

        await ErrorLog.create({
            dealId: "SYSTEM", logType: 'INFO', stage: 'WEEKLY_RECONCILIATION',
            messages: [`Reconciliation finished. Updated: ${successCount}, Failed: ${failCount}`]
        });

    } catch (error) {
        console.error("CRITICAL CRON ERROR:", error.message);
    }
};

// To run weekly on Sundays at 2:00 AM
cron.schedule('0 2 * * 0', () => {
    runWeeklyReconciliation();
});

// To run daily at 2:00 AM
// cron.schedule('0 2 * * *', () => {
//     runWeeklyReconciliation();
// });

module.exports = { runWeeklyReconciliation };

