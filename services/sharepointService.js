const axios = require('axios');
const { getGraphToken } = require('../utils/auth');

const getExistingDealFolderNameBySAP = async (token, siteId, driveId, sapId, safeDealName, dealId) => {
    try {
        // UPDATED: Using the exact Internal Name 'Client_x0020_Code' provided
        const queryUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/list/items?$expand=fields&$filter=fields/Client_x0020_Code eq '${sapId}'`;
        
        const response = await axios.get(queryUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data.value && response.data.value.length > 0) {
            const accountFolderItem = response.data.value[0]; 
            const accountFolderName = accountFolderItem.name;
            const targetDealFolder = `${safeDealName}_${dealId}`;
            
            return { accountFolderName, targetDealFolder };
        }
    } catch (error) {
        console.warn(`Could not find folder by Client Code (${sapId}):`, error.response ? JSON.stringify(error.response.data) : error.message);
    }
    
    return null;
};

exports.uploadFileToSharePoint = async (fileName, fileBuffer, dealName, dealId, sapId, accountName) => {
    const token = await getGraphToken();
    const siteId = process.env.MS_SHAREPOINT_SITE_ID || process.env.MS_SITE_ID;
    const driveId = process.env.MS_SHAREPOINT_DRIVE_ID || process.env.MS_DRIVE_ID;
    const safeFileName = fileName ? fileName.replace(/[~#%&*{}\\:<>?\/|"]+/g, '').trim() : '';
    const safeDealName = dealName.replace(/[<>:"/\\|?*]+/g, '').trim();
    
    // 1. Attempt to find the existing parent folder using the SAP ID
    const folderData = await getExistingDealFolderNameBySAP(token, siteId, driveId, sapId, safeDealName, dealId);

    let finalAccountFolderName;
    let targetDealFolder = `${safeDealName}_${dealId}`;

    if (folderData) {
        // Success: Use the exact folder name returned by SharePoint
        finalAccountFolderName = folderData.accountFolderName;
    } else {
        // Fallback: Build the path using the Account Name provided by Zoho
        finalAccountFolderName = accountName ? accountName.replace(/[<>:"/\\|?*]+/g, '').trim() : '_Test_Client';
    }

    // 2. Build the final path
    const fullPath = `${finalAccountFolderName}/BD/Proposals/${targetDealFolder}/${safeFileName}`;
    const encodedPath = fullPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

    try {
        const response = await axios.put(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`,
            fileBuffer,
            { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' } }
        );
        return response.data.webUrl;
    } catch (error) {
        throw new Error(`Failed to upload to SP: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
};



exports.uploadDraftProposal = async (fileName, fileBuffer, dealName, dealId) => {
    const token = await getGraphToken();
    const siteId = process.env.DRAFT_SITE_ID;
    const driveId = process.env.DRAFT_DRIVE_ID;

    // Creates a folder for the deal, e.g., "DealName_12345/Proposal.pdf"
    const safeDealName = dealName.replace(/[<>:"/\\|?*]+/g, '').trim();
    const safeFileName = fileName ? fileName.replace(/[~#%&*{}\\:<>?\/|"]+/g, '').trim() : '';
    const fullPath = `${safeDealName}_${dealId}/${safeFileName}`;

    const encodedPath = fullPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

    try {
        const response = await axios.put(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`,
            fileBuffer,
            { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' } }
        );
        return response.data.webUrl; // Returns the shareable SharePoint link
    } catch (error) {
        throw new Error(`Failed to upload Draft to SP: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
};