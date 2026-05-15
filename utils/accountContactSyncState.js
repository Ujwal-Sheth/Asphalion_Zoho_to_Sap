const fs   = require('fs');
const path = require('path');

const SYNC_STATE_FILE = path.join(__dirname, '../config/crmSyncState.json');

/**
 * Reads the last-sync timestamps from disk.
 * Returns { accountsLastSync: string|null, contactsLastSync: string|null }
 */
const readSyncState = () => {
    try {
        if (fs.existsSync(SYNC_STATE_FILE)) {
            return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8'));
        }
    } catch (_) { /* ignore parse errors */ }
    return { accountsLastSync: null, contactsLastSync: null };
};

/**
 * Persists updated sync timestamps to disk.
 * @param {Object} updates - Partial { accountsLastSync, contactsLastSync }
 */
const writeSyncState = (updates) => {
    const current = readSyncState();
    const next    = { ...current, ...updates };
    fs.mkdirSync(path.dirname(SYNC_STATE_FILE), { recursive: true });
    fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(next, null, 2), 'utf8');
};

module.exports = { readSyncState, writeSyncState };
