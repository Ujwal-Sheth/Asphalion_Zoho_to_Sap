require('dotenv').config();
const { runCrmSync } = require('../cron/accountContactSyncJob');
const { writeSyncState } = require('../utils/accountContactSyncState');
const logger = require('../utils/logger');

const run = async () => {
    logger.info("🔄 Resetting last sync state to force a FULL sync...");
    writeSyncState({ accountsLastSync: null, contactsLastSync: null });
    
    logger.info("🚀 Starting Sync Job...");
    await runCrmSync();
    logger.info("🏁 Sync Job test done.");
    process.exit(0);
};

run().catch(err => {
    console.error(err);
    process.exit(1);
});
