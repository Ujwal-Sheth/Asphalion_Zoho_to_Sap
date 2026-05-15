const cron           = require('node-cron');
const logger         = require('../utils/logger');
const { syncAccounts } = require('./syncSapAccounts');
const { syncContacts } = require('./syncSapContacts');

/**
 * Runs the full CRM sync: Accounts first, then Contacts.
 * Contacts depend on Accounts existing, so order matters.
 */
const runCrmSync = async () => {
    logger.info(`\n🔄 [CRM Sync] Starting SAP → Zoho CRM Sync: ${new Date().toISOString()}`);
    try {
        await syncAccounts();
        await syncContacts();
        logger.info(`\n✅ [CRM Sync] Completed successfully: ${new Date().toISOString()}`);
    } catch (err) {
        logger.error(`\n❌ [CRM Sync] Critical failure: ${err.message}`);
    }
};

// ── Scheduler ──────────────────────────────────────────────────────────────
// Runs every 30 minutes
cron.schedule('*/30 * * * *', () => {
    runCrmSync();
});

module.exports = { runCrmSync };
