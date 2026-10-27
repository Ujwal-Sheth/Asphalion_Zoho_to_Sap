const axios = require('axios');
const { getGraphToken } = require('../utils/auth');

// SharePoint folder content type IDs always start with 0x0120
const isFolderItem = (item) =>
    Boolean(item?.driveItem?.folder) ||
    (item?.contentType?.id || '').startsWith('0x0120');

// True when the item sits directly under the drive root (e.g. Projects/<Account>)
const isTopLevelItem = (item, rootId) =>
    item?.driveItem?.parentReference?.id === rootId ||
    (item?.driveItem?.parentReference?.path || '').endsWith('root:');

/**
 * Resolves the ACCOUNT FOLDER for a given SAP ID.
 *
 * FIX (Oct 2026): the previous version returned value[0] from the Client Code
 * query without checking the item type. Files inside the account folder also
 * carry Client_Code (e.g. "Ochi et al. 2024 not relevant.pdf" -> BBS), so a FILE
 * could be returned and its name was used as the account folder, creating
 * orphan root folders like "Projects/<file name>/BD/Proposals/...".
 *
 * Now: only folders located directly under the drive root are accepted;
 * 0 matches or >1 matches abort the sync (no orphan folders are ever created).
 */
const getAccountFolderBySAP = async (token, siteId, driveId, sapId) => {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Prefer': 'HonorNonIndexedQueriesWarningMayFailRandomly'
    };

    // Keeps Graph's response body in the error so it reaches ErrorLog and the Deal note
    const graphGet = async (url) => {
        try {
            return await axios.get(url, { headers });
        } catch (error) {
            throw new Error(`Failed to look up SP account folder for SAP ID '${sapId}': ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        }
    };

     const rootRes = await graphGet(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root?$select=id`
    );
    const rootId = rootRes.data.id;

    const safeSap = String(sapId).replace(/'/g, "''");
    let nextUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/list/items` +
        `?$expand=fields,driveItem&$filter=fields/Client_x0020_Code eq '${safeSap}'`;

    const candidates = [];
    let ignored = 0;

    while (nextUrl) {
        const response = await axios.get(nextUrl, { headers });
        for (const item of response.data.value || []) {
            if (isFolderItem(item) && isTopLevelItem(item, rootId)) {
                candidates.push(item);
            } else {
                ignored++;
            }
        }
        nextUrl = response.data['@odata.nextLink'] || null;
    }

    console.log(`SAP ${sapId}: ${candidates.length} top-level folder match(es), ${ignored} non-folder/nested item(s) ignored.`);

    if (candidates.length === 0) {
        const err = new Error(`Account folder for SAP ID '${sapId}' not found at SharePoint root (${ignored} non-folder items with that Client Code were ignored). Cannot route files.`);
        err.code = 'SP_FOLDER_NOT_FOUND';
        err.sapId = sapId;
        throw err;
    }
    if (candidates.length > 1) {
        const names = candidates.map(c => c.driveItem?.name).join(', ');
        const err = new Error(`Ambiguous SAP ID '${sapId}': ${candidates.length} top-level folders match (${names}). Cannot route files.`);
        err.code = 'SP_FOLDER_AMBIGUOUS';
        err.sapId = sapId;
        throw err;
    }

    const folder = candidates[0];
    return {
        id: folder.driveItem.id,
        name: folder.driveItem.name,
        webUrl: folder.driveItem.webUrl
    };
};

exports.uploadFileToSharePoint = async (fileName, fileBuffer, subFolder, sapId, accountName, dealName, dealCode) => {
    const token = await getGraphToken();
    const siteId = process.env.MS_SHAREPOINT_SITE_ID || process.env.MS_SITE_ID;
    const driveId = process.env.MS_SHAREPOINT_DRIVE_ID || process.env.MS_DRIVE_ID;
    const safeFileName = fileName ? fileName.replace(/[~#%&*{}\\:<>?\/|"]+/g, '').trim() : '';
    const safeDealName = dealName.replace(/[<>:"/\\|?*]+/g, '').trim();

    // 1. Resolve the account folder (throws if not found / ambiguous -> no orphan folders)
    const accountFolder = await getAccountFolderBySAP(token, siteId, driveId, sapId);
    console.log(`📁 Account folder resolved: ${accountFolder.name} (${accountFolder.webUrl})`);

    // 2. Build the path RELATIVE to the account folder item (not to the drive root)
    const targetDealFolder = `${safeDealName}_${dealCode}`;
    const relativePath = `BD/${subFolder}/${targetDealFolder}/${safeFileName}`;
    const encodedPath = relativePath.split('/').map(segment => encodeURIComponent(segment)).join('/');

    try {
        const response = await axios.put(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${accountFolder.id}:/${encodedPath}:/content`,
            fileBuffer,
            { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' } }
        );
        return response.data.webUrl;
    } catch (error) {
        throw new Error(`Failed to upload to SP: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
};

const getContainingFolderWebUrl = async (token, siteId, driveId, folderPath) => {
    const encodedFolderPath = folderPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
    try {
        const response = await axios.get(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedFolderPath}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        return response.data.webUrl;
    } catch (error) {
        console.warn(`Could not resolve draft folder webUrl for "${folderPath}":`, error.response ? JSON.stringify(error.response.data) : error.message);
        return null;
    }
};


exports.uploadDraftProposal = async (fileName, fileBuffer, dealName, dealId) => {
    const token = await getGraphToken();
    const siteId = process.env.DRAFT_SITE_ID;
    const driveId = process.env.DRAFT_DRIVE_ID;

    // Creates a folder for the deal, e.g., "DealName_12345/Proposal.pdf"
    const safeDealName = dealName.replace(/[<>:"/\\|?*]+/g, '').trim();
    const safeFileName = fileName ? fileName.replace(/[~#%&*{}\\:<>?\/|"]+/g, '').trim() : '';
    const folderPath = `${safeDealName}_${dealId}`;
    const fullPath = `${folderPath}/${safeFileName}`;

    const encodedPath = fullPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

    try {
        const response = await axios.put(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodedPath}:/content`,
            fileBuffer,
            { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' } }
        );

        const folderUrl = await getContainingFolderWebUrl(token, siteId, driveId, folderPath);
         if (folderUrl) return folderUrl;

        const fileUrl = response.data.webUrl;
        return fileUrl.substring(0, fileUrl.lastIndexOf('/'));
        // return response.data.webUrl; // Returns the shareable SharePoint link
    } catch (error) {
        throw new Error(`Failed to upload Draft to SP: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
    }
};