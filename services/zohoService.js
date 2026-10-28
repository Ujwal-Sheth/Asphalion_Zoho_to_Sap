const axios = require('axios');
const { getAccessToken } = require('../utils/auth');

exports.getDealAttachments = async (dealId) => {
    const token = await getAccessToken();
    try {
        const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/Deals/${dealId}/Attachments`,
            {
                headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
                params: { fields: 'id,File_Name,Size,Created_Time' }
            }
        );
        return response.data.data || [];
    } catch (error) {
        if (error.response && error.response.status === 204) return [];
        throw new Error(`Failed to fetch attachments: ${error.message}`);
    }
};

exports.downloadAttachment = async (dealId, attachmentId) => {
    const token = await getAccessToken();
    try {
        const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/Deals/${dealId}/Attachments/${attachmentId}`,
            {
                headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
                responseType: 'arraybuffer'
            }
        );
        return response.data;
    } catch (error) {
        throw new Error(`Failed to download attachment ${attachmentId}: ${error.message}`);
    }
};

exports.getRecord = async (moduleName, recordId) => {
    const token = await getAccessToken();
    try {
        const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/${moduleName}/${recordId}`,
            {
                headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
            }
        );
        return response.data.data[0];
    } catch (error) {
        throw new Error(`Failed to fetch ${moduleName} record ${recordId}: ${error.message}`);
    }
};


exports.updateDealField = async (dealId, updateData) => {
    const token = await getAccessToken();
    try {
        const response = await axios.put(
            `${process.env.ZOHO_API_DOMAIN}/Deals/${dealId}`,
            {
                data: [
                    {
                        id: dealId,
                        ...updateData
                    }
                ]
            },
            {
                headers: { 'Authorization': `Zoho-oauthtoken ${token}` }
            }
        );
        return response.data;
    } catch (error) {
        let details = '';
        if (error.response && error.response.data) {
            details = JSON.stringify(error.response.data);
        }
        throw new Error(`Failed to update deal ${dealId}: ${error.message}. Details: ${details}`);
    }
};

exports.runCoqlQuery = async (query) => {
    const token = await getAccessToken();
    try {
        const response = await axios.post(
            `${process.env.ZOHO_API_DOMAIN}/coql`,
            { select_query: query },
            { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } }
        );
        return response.data.data || [];
    } catch (error) {
        throw new Error(`Failed to run COQL query: ${error.message}`);
    }
};

exports.searchProductsByName = async (productName) => {
    const token = await getAccessToken();
    try {
        const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/Products/search`,
            {
                headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
                // Escape parentheses which break Zoho's criteria parser
                params: { criteria: `(Product_Name:equals:${productName.replace(/[()]/g, '')})` }
            }
        );
        return response.data.data || [];
    } catch (error) {
        if (error.response && (error.response.status === 204 || error.response.status === 400)) {
            console.warn(`⚠️ Could not search product "${productName}":`, error.response.data?.message || 'Invalid criteria');
        }
        return [];
    }
}

exports.searchProductsByCode = async (productCode) => {
    const token = await getAccessToken();
    try {
        const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/Products/search`,
            {
                headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
                params: { criteria: `(Product_Name:equals:${productCode})` }
            }
        );
        return response.data.data || [];
    } catch (error) {
        if (error.response && (error.response.status === 204 || error.response.status === 400)) {
            console.warn(`⚠️ Could not search product code "${productCode}":`, error.response.data?.message || 'Invalid criteria');
        }
        return [];
    }
}

exports.getExpenseProductIds = async (productIds = []) => {
    const ids = [...new Set(productIds.filter(Boolean).map(String))];
    const result = new Set();
    if (!ids.length) return result;

    try {
        for (let i = 0; i < ids.length; i += 50) {          // COQL IN limit: 50
            const chunk = ids.slice(i, i + 50).join(',');
            const rows = await exports.runCoqlQuery(
                `select id from Products where id in (${chunk}) and Expense_Product = true`
            );
            rows.forEach(r => result.add(String(r.id)));
        }
    } catch (error) {
        console.error('[ZOHO] Could not read Expense_Product – position type sent as usual:', error.message);
    }
    return result;
};


// Adds a Note to a Deal (shown in the Deal's Notes and Timeline)
exports.addNoteToDeal = async (dealId, title, content) => {
    const token = await getAccessToken();
    try {
        const response = await axios.post(
            `${process.env.ZOHO_API_DOMAIN}/Deals/${dealId}/Notes`,
            { data: [{ Note_Title: title, Note_Content: content }] },
            { headers: { 'Authorization': `Zoho-oauthtoken ${token}` } }
        );
        return response.data;
    } catch (error) {
        const details = error.response && error.response.data ? JSON.stringify(error.response.data) : '';
        throw new Error(`Failed to add note to deal ${dealId}: ${error.message}. Details: ${details}`);
    }
};
 