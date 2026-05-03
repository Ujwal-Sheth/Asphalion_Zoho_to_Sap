const axios = require('axios');
const { getGraphToken } = require('../utils/auth');

const getExistingDealFolderName = async (token, siteId, driveId, safeDealName, dealId) => {
    const basePath = encodeURIComponent('_Test_Client/BD/Proposals');
    try {
        const response = await axios.get(`https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${basePath}:/children`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const existingFolder = response.data.value.find(item => item.folder && item.name.includes(`_${dealId}`));
        if (existingFolder) return existingFolder.name;
    } catch (error) {
        if (error.response && error.response.status !== 404) console.warn("Could not check folders:", error.message);
    }
    return `${safeDealName}_${dealId}`;
};

exports.uploadFileToSharePoint = async (fileName, fileBuffer, dealName, dealId) => {
    const token = await getGraphToken();
    const siteId = process.env.MS_SHAREPOINT_SITE_ID || process.env.MS_SITE_ID; // Supporting both env naming conventions
    const driveId = process.env.MS_SHAREPOINT_DRIVE_ID || process.env.MS_DRIVE_ID;

    const safeDealName = dealName.replace(/[<>:"/\\|?*]+/g, '').trim();
    const targetDealFolder = await getExistingDealFolderName(token, siteId, driveId, safeDealName, dealId);

    const fullPath = `_Test_Client/BD/Proposals/${targetDealFolder}/${fileName}`;
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
    const fullPath = `${safeDealName}_${dealId}/${fileName}`;

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