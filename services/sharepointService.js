const axios = require('axios');
const { getGraphToken } = require('../utils/auth');

// Graph GET with diagnostics: 1 retry on 401 (fresh token) and on 429/503 (Retry-After)
const graphGet = async (url, tokenRef, label) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await axios.get(url, { headers: { 'Authorization': `Bearer ${tokenRef.token}` } });
        } catch (error) {
            const status = error.response?.status;
            const body = error.response?.data ? JSON.stringify(error.response.data).slice(0, 500) : error.message;
            console.warn(`⚠️ Graph ${label} failed (attempt ${attempt}, status ${status}): ${body}`);
            if (attempt < 3 && status === 401) { tokenRef.token = await getGraphToken(true); continue; }
            if (attempt < 3 && (status === 429 || status === 503)) {
                const wait = (parseInt(error.response.headers?.['retry-after'], 10) || 5) * 1000;
                await new Promise(r => setTimeout(r, wait));
                continue;
            }
            const err = new Error(`Graph ${label} failed with status ${status}: ${body}`);
            err.status = status;
            throw err;
        }
    }
};

/**
 * Resolves the ACCOUNT FOLDER for a given SAP ID.
 *
 * v2 (Oct 2026): instead of searching every list item with that Client Code
 * (files included - tens of thousands for big clients such as APF, which made the
 * lookup slow and failed with 401), it reads ONLY the top-level folders of the
 * library (one per client) and compares their Client Code.
 * Speed no longer depends on how many files a client has.
 * Rules unchanged: exactly one matching top-level folder, otherwise error, never create.
 */
// Short-lived cache so the folder is resolved once per sync, not once per attachment
const folderCache = new Map(); // key: sapId -> { folder, expires }
const FOLDER_CACHE_MS = 5 * 60 * 1000;

const getAccountFolderBySAP = async (siteId, driveId, sapId) => {
    const cacheKey = String(sapId).trim().toUpperCase();
    const cached = folderCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
        console.log(`SAP ${sapId}: folder reused from this sync (${cached.folder.name}).`);
        return cached.folder;
    }
    const folder = await resolveAccountFolderBySAP(siteId, driveId, sapId);
    folderCache.set(cacheKey, { folder, expires: Date.now() + FOLDER_CACHE_MS });
    return folder;
};

const resolveAccountFolderBySAP = async (siteId, driveId, sapId) => {
    const tokenRef = { token: await getGraphToken() };
    const wanted = String(sapId).trim().toUpperCase();

    let nextUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/children` +
        `?$select=id,name,webUrl,folder&$expand=listItem($expand=fields($select=Client_x0020_Code))&$top=200`;

    const candidates = [];
    let scanned = 0;
    let page = 0;

    while (nextUrl) {
        page++;
        const response = await graphGet(nextUrl, tokenRef, `root folders page ${page}`);
        for (const item of response.data.value || []) {
            scanned++;
            if (!item.folder) continue;
            const code = item.listItem?.fields?.Client_x0020_Code;
            if (code && String(code).trim().toUpperCase() === wanted) candidates.push(item);
        }
        nextUrl = response.data['@odata.nextLink'] || null;
    }

    console.log(`SAP ${sapId}: ${candidates.length} top-level folder match(es) among ${scanned} root item(s) (${page} page(s)).`);

    if (candidates.length === 0) {
        const err = new Error(`Account folder for SAP ID '${sapId}' not found at SharePoint root (${scanned} root items checked). Cannot route files.`);
        err.code = 'SP_FOLDER_NOT_FOUND';
        err.sapId = sapId;
        throw err;
    }
    if (candidates.length > 1) {
        const names = candidates.map(c => c.name).join(', ');
        const err = new Error(`Ambiguous SAP ID '${sapId}': ${candidates.length} top-level folders match (${names}). Cannot route files.`);
        err.code = 'SP_FOLDER_AMBIGUOUS';
        err.sapId = sapId;
        throw err;
    }

    const folder = candidates[0];
    return { id: folder.id, name: folder.name, webUrl: folder.webUrl };
};

exports.uploadFileToSharePoint = async (fileName, fileBuffer, subFolder, sapId, accountName, dealName, dealCode) => {
    const token = await getGraphToken();
    const siteId = process.env.MS_SHAREPOINT_SITE_ID || process.env.MS_SITE_ID;
    const driveId = process.env.MS_SHAREPOINT_DRIVE_ID || process.env.MS_DRIVE_ID;
    const safeFileName = fileName ? fileName.replace(/[~#%&*{}\\:<>?\/|"]+/g, '').trim() : '';
    const safeDealName = dealName.replace(/[<>:"/\\|?*]+/g, '').trim();

    // 1. Resolve the account folder (throws if not found / ambiguous -> no orphan folders)
    const accountFolder = await getAccountFolderBySAP(siteId, driveId, sapId);
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