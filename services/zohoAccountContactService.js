const axios = require('axios');
const { getAccessToken } = require('../utils/auth');

// ─── Generic helper ──────────────────────────────────────────────────────────

/**
 * Search any Zoho module using the Search API with a field criteria.
 * @param {string} module - e.g. 'Accounts', 'Contacts'
 * @param {string} field  - API name of the field to match
 * @param {string} value  - value to match (equals)
 * @returns {Promise<Object|null>} First matching record or null
 */
const searchByField = async (module, field, value) => {
    const token = await getAccessToken();
    try {
        const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/${module}/search`,
            {
                headers: { Authorization: `Zoho-oauthtoken ${token}` },
                params: { criteria: `(${field}:equals:${value})` },
            }
        );
        const records = response.data?.data;
        return records && records.length > 0 ? records[0] : null;
    } catch (err) {
        if (err.response?.status === 204 || err.response?.status === 400) return null;
        throw err;
    }
};

/**
 * Create a new record in any Zoho module.
 * @param {string} module 
 * @param {Object} payload 
 * @returns {Promise<string>} ID of the created record
 */
const createRecord = async (module, payload) => {
    const token = await getAccessToken();
    const response = await axios.post(
        `${process.env.ZOHO_API_DOMAIN}/${module}`,
        { data: [payload] },
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const result = response.data?.data?.[0];
    if (result?.code !== 'SUCCESS') {
        throw new Error(`Zoho ${module} create failed: ${JSON.stringify(result)}`);
    }
    return result.details.id;
};

/**
 * Update an existing record in any Zoho module.
 * @param {string} module 
 * @param {string} recordId 
 * @param {Object} payload 
 */
const updateRecord = async (module, recordId, payload) => {
    const token = await getAccessToken();
    const response = await axios.put(
        `${process.env.ZOHO_API_DOMAIN}/${module}/${recordId}`,
        { data: [{ id: recordId, ...payload }] },
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const result = response.data?.data?.[0];
    if (result?.code !== 'SUCCESS') {
        const details = JSON.stringify(result?.details || response.data);
        throw new Error(`Zoho ${module} update failed: ${details}`);
    }
};

// ─── Accounts ────────────────────────────────────────────────────────────────

/**
 * Search Zoho Accounts by Tax ID.
 * @param {string} taxId
 * @returns {Promise<Object|null>}
 */
const findAccountByTaxId = async (taxId) => {
    return searchByField('Accounts', 'Tax_ID', taxId);
};

/**
 * Create or update a Zoho Account.
 * @param {Object} payload - Zoho field map
 * @param {string|null} existingId - Existing Zoho record ID (for update)
 * @returns {Promise<{id: string, action: string}>}
 */
const upsertZohoAccount = async (payload, existingId = null) => {
    if (existingId) {
        await updateRecord('Accounts', existingId, payload);
        return { id: existingId, action: 'updated' };
    }
    const newId = await createRecord('Accounts', payload);
    return { id: newId, action: 'created' };
};

// ─── Contacts ─────────────────────────────────────────────────────────────────

/**
 * Search Zoho Contacts by Email.
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
const findContactByEmail = async (email) => {
    return searchByField('Contacts', 'Email', email);
};

/**
 * Create or update a Zoho Contact.
 * @param {Object} payload - Zoho field map
 * @param {string|null} existingId - Existing Zoho record ID (for update)
 * @returns {Promise<{id: string, action: string}>}
 */
const upsertZohoContact = async (payload, existingId = null) => {
    if (existingId) {
        await updateRecord('Contacts', existingId, payload);
        return { id: existingId, action: 'updated' };
    }
    const newId = await createRecord('Contacts', payload);
    return { id: newId, action: 'created' };
};

module.exports = {
    findAccountByTaxId,
    upsertZohoAccount,
    findContactByEmail,
    upsertZohoContact,
    searchByField,
};
