const cron = require('node-cron');
const zohoService = require('../services/zohoService');
const { getSapQuoteDetails } = require('../services/sapService');
const { mapSapDataToZoho } = require('../utils/sapMapper');
const ErrorLog = require('../models/errorLogModel');
const { getCurrentIsoDateTimeForZoho } = require('../utils/dateUtils');

const runWeeklyReconciliation = async () => {
    console.log(`\n🔄 [CRON] Starting Weekly SAP-Zoho Reconciliation: ${new Date().toISOString()}`);

    try {
        const coqlQuery = "select id, Deal_Name, SAP_Offer_Code, Stage from Deals where SAP_Offer_Code is not null";
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

            try {
                await zohoService.updateDealField(deal.id, {
                    SAP_Shipment_Status: zohoStatusUpdate,
                    SAP_Shipment_Date: getCurrentIsoDateTimeForZoho(),
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

cron.schedule('0 2 * * 0', () => {
    runWeeklyReconciliation();
});

module.exports = { runWeeklyReconciliation };

