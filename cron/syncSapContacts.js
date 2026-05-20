const logger                              = require('../utils/logger');
const { getSapContacts }                  = require('../services/sapAccountContactService');
const { findAccountByTaxId, findContactByEmail, upsertZohoContact } = require('../services/zohoAccountContactService');
const { mapSapContactToZohoContact }      = require('../utils/accountContactMapper');
const { readSyncState, writeSyncState }   = require('../utils/accountContactSyncState');

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
            logger.warn(`⚠️ [Contacts] ${label} – attempt ${attempt} failed. Retrying in ${wait / 1000}s…`);
            await new Promise(r => setTimeout(r, wait));
        }
    }
};

/**
 * Basic email format validation.
 */
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * Main sync function.
 * Fetches SAP Contacts changed since the last run, then upserts them into Zoho Contacts.
 * Contacts are automatically linked to their parent Zoho Account via Tax ID.
 */
const syncContacts = async () => {
    logger.info('\n👤 [Contacts Sync] Starting SAP → Zoho Contact synchronization…');
    const startTime = new Date().toISOString();

    // Read last-sync timestamp for incremental mode
    const { contactsLastSync } = readSyncState();
    logger.info(`📅 [Contacts Sync] Incremental since: ${contactsLastSync || 'FULL SYNC'}`);

    let sapContacts;
    try {
        sapContacts = await getSapContacts(contactsLastSync);
    } catch (fetchErr) {
        logger.error(`❌ [Contacts Sync] Failed to fetch SAP Contacts: ${fetchErr.message}`);
        return;
    }

    logger.info(`📊 [Contacts Sync] ${sapContacts.length} SAP Contact(s) to process.`);

    let created = 0, updated = 0, skipped = 0, failed = 0;

    for (const sapContact of sapContacts) {
        const internalId = sapContact.BusinessPartnerContactInternalID?._ || sapContact.BusinessPartnerContactInternalID || sapContact.InternalID?._ || sapContact.InternalID || '(unknown)';

        try {
            // ── 1. Map SAP → Zoho fields ─────────────────────────────────────
            const mapped = mapSapContactToZohoContact(sapContact);

            // ── 2. Validate Email ─────────────────────────────────────────────
            if (!isValidEmail(mapped.Email)) {
                logger.warn(`⏭️  [Contacts Sync] Skipping SAP Contact ${internalId} — missing/invalid email: "${mapped.Email}"`);
                skipped++;
                continue;
            }

            // ── 3. Build Zoho payload (remove internal helper field) ───────────
            const { _relatedAccountTaxId, ...zohoPayload } = mapped;

            // ── 4. Link to parent Zoho Account via Tax ID ─────────────────────
            if (_relatedAccountTaxId) {
                const zohoAccount = await withRetry(
                    () => findAccountByTaxId(_relatedAccountTaxId),
                    `findAccountByTaxId(${_relatedAccountTaxId})`
                );
                if (zohoAccount) {
                    // Zoho expects account lookup as { id, name }
                    zohoPayload.Account_Name = { id: zohoAccount.id, name: zohoAccount.Account_Name };
                    logger.info(`🔗 [Contacts Sync] Linked contact ${internalId} to Zoho Account ${zohoAccount.id}`);
                } else {
                    logger.warn(`⚠️  [Contacts Sync] No Zoho Account found for Tax ID "${_relatedAccountTaxId}" — contact will be unlinked.`);
                }
            }

            // ── 5. Search Zoho for existing Contact by Email ──────────────────
            const existing = await withRetry(
                () => findContactByEmail(mapped.Email),
                `findContactByEmail(${mapped.Email})`
            );

            // ── 6. Upsert ─────────────────────────────────────────────────────
            const { id: zohoId, action } = await withRetry(
                () => upsertZohoContact(zohoPayload, existing?.id || null),
                `upsertZohoContact(${mapped.Email})`
            );

            if (action === 'created') {
                logger.info(`✅ [Contacts Sync] Created Zoho Contact ${zohoId} for SAP Contact ${internalId} (${mapped.Email})`);
                created++;
            } else {
                logger.info(`🔄 [Contacts Sync] Updated Zoho Contact ${existing.id} for SAP Contact ${internalId} (${mapped.Email})`);
                updated++;
            }

        } catch (err) {
            logger.error(`❌ [Contacts Sync] Failed for SAP Contact ${internalId}: ${err.message}`);
            failed++;
        }
    }

    // ── 7. Persist new sync timestamp ─────────────────────────────────────────
    writeSyncState({ contactsLastSync: startTime });

    logger.info(
        `\n🏁 [Contacts Sync] Done. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`
    );
};

module.exports = { syncContacts };
