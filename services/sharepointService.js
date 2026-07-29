const axios = require('axios');
const { getGraphToken } = require('../utils/auth');

const getExistingDealFolderNameBySAP = async (token, siteId, driveId, sapId, safeDealName, dealId) => {
    try {
        // FIX 1: Added ',driveItem' to the $expand parameter to fetch physical folder properties
        const queryUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/list/items?$expand=fields,driveItem&$filter=fields/Client_x0020_Code eq '${sapId}'`;
        
        const response = await axios.get(queryUrl, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data.value && response.data.value.length > 0) {
            const accountFolderItem = response.data.value[0]; 
            
            // Added fallbacks to FileLeafRef or Title just in case driveItem fails to expand.
            const accountFolderName = accountFolderItem.driveItem?.name 
                                      || accountFolderItem.fields?.FileLeafRef 
                                      || accountFolderItem.fields?.Title;

            if (!accountFolderName) {
                console.warn(`Found SAP ID ${sapId}, but couldn't resolve the folder name. Payload:`, accountFolderItem);
                return null; // Force fallback to Account Name if name fails to resolve
            }
            // const targetDealFolder = `${safeDealName}`;
            return accountFolderName;
        }
    } catch (error) {
        console.warn(`Could not find folder by Client Code (${sapId}):`, error.response ? JSON.stringify(error.response.data) : error.message);
    }
    
    return null;
};

exports.uploadFileToSharePoint = async (fileName, fileBuffer, subFolder, sapId, accountName, dealName, dealCode) => {
    const token = await getGraphToken();
    const siteId = process.env.MS_SHAREPOINT_SITE_ID || process.env.MS_SITE_ID;
    const driveId = process.env.MS_SHAREPOINT_DRIVE_ID || process.env.MS_DRIVE_ID;
    const safeFileName = fileName ? fileName.replace(/[~#%&*{}\\:<>?\/|"]+/g, '').trim() : '';
    const safeDealName = dealName.replace(/[<>:"/\\|?*]+/g, '').trim();
    
    // 1. Attempt to find the existing parent folder using the SAP ID
    const fetchedFolderName = await getExistingDealFolderNameBySAP(token, siteId, driveId, sapId);

    if (!fetchedFolderName) {
        // If the folder isn't found, abort immediately. The controller will catch this and log the error.
        throw new Error(`Account folder for SAP ID '${sapId}' does not exist in SharePoint. Cannot route files.`);
    }

    const finalAccountFolderName = fetchedFolderName;
    let targetDealFolder = `${safeDealName}_${dealCode}`;

    // 2. Build the final path
    const fullPath = `${finalAccountFolderName}/BD/${subFolder}/${targetDealFolder}/${safeFileName}`;
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