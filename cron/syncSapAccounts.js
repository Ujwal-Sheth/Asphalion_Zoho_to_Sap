const logger                            = require('../utils/logger');
const { getSapCustomers }               = require('../services/sapAccountContactService');
const { findAccountByTaxId, upsertZohoAccount } = require('../services/zohoAccountContactService');
const { mapSapCustomerToZohoAccount }   = require('../utils/accountContactMapper');
const { readSyncState, writeSyncState } = require('../utils/accountContactSyncState');

/**
 * Retry a Zoho API operation up to `maxRetries` times with exponential back-off.
 */
const withRetry = async (fn, label, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            if (attempt === maxRetries) throw err;
            const wait = attempt * 2000;
            logger.warn(`⚠️ [Accounts] ${label} – attempt ${attempt} failed. Retrying in ${wait / 1000}s…`);
            await new Promise(r => setTimeout(r, wait));
        }
    }
};

/**
 * Validates a parsed SAP Customer record.
 * Returns the Tax ID string, or null if the record should be skipped.
 */
const extractTaxId = (sapCustomer) => {
    const taxEntry = sapCustomer.TaxNumber;
    if (taxEntry) {
        const taxArr   = Array.isArray(taxEntry) ? taxEntry : [taxEntry];
        // PartyTaxID holds the actual CIF/NIF/VAT number
        const vatEntry = taxArr.find(t => {
            const code = t.TaxIdentificationNumberTypeCode;
            const codeVal = typeof code === 'object' ? code._ : String(code || '');
            return codeVal === '5';
        }) || taxArr[0];
        const partyTaxId = vatEntry?.PartyTaxID;
        if (partyTaxId) {
            const str = typeof partyTaxId === 'object' ? partyTaxId._ : String(partyTaxId);
            if (str?.trim()) return str.trim();
        }
    }
    // Fallback: DunAndBradstreet number
    const duns = sapCustomer.DunAndBradstreetNumberID;
    if (duns) {
        const str = typeof duns === 'object' ? duns._ : String(duns);
        return str?.trim() || null;
    }
    return null;
};

/**
 * Main sync function.
 * Fetches SAP Customers changed since the last run, then upserts them into Zoho Accounts.
 */
const syncAccounts = async () => {
    logger.info('\n🏢 [Accounts Sync] Starting SAP → Zoho Account synchronization…');
    const startTime = new Date().toISOString();

    // Read last-sync timestamp for incremental mode
    const { accountsLastSync } = readSyncState();
    logger.info(`📅 [Accounts Sync] Incremental since: ${accountsLastSync || 'FULL SYNC'}`);

    let sapCustomers;
    try {
        sapCustomers = await getSapCustomers(accountsLastSync);
    } catch (fetchErr) {
        logger.error(`❌ [Accounts Sync] Failed to fetch SAP Customers: ${fetchErr.message}`);
        return;
    }

    logger.info(`📊 [Accounts Sync] ${sapCustomers.length} SAP Customer(s) to process.`);

    let created = 0, updated = 0, skipped = 0, failed = 0;

    for (const sapCustomer of sapCustomers) {
        const internalId = sapCustomer.InternalID?._
            || sapCustomer.InternalID
            || '(unknown)';

        // ── 1. Validate Tax ID ───────────────────────────────────────────────
        const taxId = extractTaxId(sapCustomer);
        if (!taxId) {
            logger.warn(`⏭️  [Accounts Sync] Skipping SAP Customer ${internalId} — no Tax ID.`);
            skipped++;
            continue;
        }

        try {
            // ── 2. Map SAP → Zoho fields ─────────────────────────────────────
            const zohoPayload = mapSapCustomerToZohoAccount(sapCustomer);

            // ── 3. Search Zoho for existing Account ──────────────────────────
            const existing = await withRetry(
                () => findAccountByTaxId(taxId),
                `findAccountByTaxId(${taxId})`
            );

            // ── 4. Upsert ────────────────────────────────────────────────────
            const { id: zohoId, action } = await withRetry(
                () => upsertZohoAccount(zohoPayload, existing?.id || null),
                `upsertZohoAccount(${taxId})`
            );

            if (action === 'created') {
                logger.info(`✅ [Accounts Sync] Created Zoho Account ${zohoId} for SAP Customer ${internalId} (Tax: ${taxId})`);
                created++;
            } else {
                logger.info(`🔄 [Accounts Sync] Updated Zoho Account ${existing.id} for SAP Customer ${internalId} (Tax: ${taxId})`);
                updated++;
            }

        } catch (err) {
            logger.error(`❌ [Accounts Sync] Failed for SAP Customer ${internalId} (Tax: ${taxId}): ${err.message}`);
            failed++;
        }
    }

    // ── 5. Persist new sync timestamp ────────────────────────────────────────
    writeSyncState({ accountsLastSync: startTime });

    logger.info(
        `\n🏁 [Accounts Sync] Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`
    );
};

module.exports = { syncAccounts };
