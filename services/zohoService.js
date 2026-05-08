const axios = require('axios');
const { getAccessToken } = require('../utils/auth');

exports.getDealAttachments = async (dealId) => {
    const token = await getAccessToken();
    try {
        const response = await axios.get(
            `${process.env.ZOHO_API_DOMAIN}/Deals/${dealId}/Attachments`,
            {
                headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
                params: { fields: 'id,File_Name,Size' }
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
    }
}