const zohoService = require('../services/zohoService');
const sharepointService = require('../services/sharepointService');
const ErrorLog = require('../models/errorLogModel'); // Added your unified error logger

const ZOHO_SP_FOLDER_FIELD_API_NAME = "SharePoint_Folder_URL";
const ZOHO_SP_LINK_FIELD_API_NAME = "Sharepoint_Draft_Link";

exports.handleQuoteApproval = async (req, res) => {
    // Immediately respond to Zoho to prevent timeouts
    res.status(202).json({ message: "Webhook accepted, processing files in background." });

    const payload = req.body;
    const zohoDealId = payload.dealId || payload.quote_details?.zoho_deal_id; 
    const dealName = payload.dealName || payload.quote_details?.title || 'Unknown_Deal';

    if (!zohoDealId) {
        console.error("Missing Deal ID in payload.");
        return;
    }

    console.log(`\n--- SharePoint Sync Triggered for Deal: ${zohoDealId} ---`);

    try {
        console.log(`[1/4] Fetching Deal data to find linked Account...`);
        const dealData = await zohoService.getRecord('Deals', zohoDealId);
        
        if (!dealData.Account_Name || !dealData.Account_Name.id) {
            throw new Error("No Account linked to this Deal. Cannot fetch SAP ID.");
        }
        
        console.log(`[2/4] Fetching Account data to extract SAP ID...`);
        const accountData = await zohoService.getRecord('Accounts', dealData.Account_Name.id);
        
        const sapId = accountData.SAP_Customer_ID;
        
        if (!sapId) {
            throw new Error("Linked Account does not have an SAP Customer ID.");
        }
        
        console.log(`✅ Extracted SAP ID: ${sapId}`);

        console.log(`[3/4] Fetching Deal Attachments...`);
        const attachments = await zohoService.getDealAttachments(zohoDealId);
        if (!attachments || attachments.length === 0) {
            console.log(`⚠️ No attachments found for Deal: ${zohoDealId}`);
            return; 
        }

        console.log(`✅ Found ${attachments.length} attachment(s). Starting sync...`);
        const uploadedFilesInfo = [];

        for (const att of attachments) {
            console.log(`⬇️ Downloading: ${att.File_Name}`);
            const fileBuffer = await zohoService.downloadAttachment(zohoDealId, att.id);
            
            // --- NEW: Dynamic Folder Routing Logic ---
            let targetSubFolder = 'bd'; // Fallback root folder
            
            // Convert to uppercase once for safe case-insensitive checking
            const upperFileName = att.File_Name.toUpperCase(); 

            if (upperFileName.includes('SIGNED_DEAL_CONTRACT') || upperFileName.includes('ZOHO_SIGNED')) {
                targetSubFolder = 'bd/Offers';
            } else if (upperFileName.startsWith('MSA') || upperFileName.startsWith('PO')) {
                targetSubFolder = 'bd/Contracts';
            } else if (upperFileName.startsWith('NDA')) {
                targetSubFolder = 'bd/CDAs';
            }
            // -----------------------------------------

            console.log(`⬆️ Uploading to SharePoint -> /${targetSubFolder}...`);
            const spUrl = await sharepointService.uploadFileToSharePoint(
                att.File_Name, 
                fileBuffer, 
                dealName,
                sapId, 
                targetSubFolder // Passes the dynamic folder path
            );
            uploadedFilesInfo.push({ fileName: att.File_Name, sharepointUrl: spUrl });
        }

        console.log(`\n[4/4] SHAREPOINT SYNC COMPLETE`);
        console.log(`Successfully migrated ${uploadedFilesInfo.length} files.`);

        // --- Push Folder URL back to Zoho ---
        if (uploadedFilesInfo.length > 0) {
            let firstFileUrl = uploadedFilesInfo[0].sharepointUrl;
            let folderUrl = firstFileUrl.split('?')[0]; 
            // Navigates up two directories to capture the parent "bd" folder, not the specific subfolder
            folderUrl = folderUrl.substring(0, folderUrl.lastIndexOf('/')); 
            folderUrl = folderUrl.substring(0, folderUrl.lastIndexOf('/'));

            console.log(`🔗 Updating Zoho Deal with SharePoint Folder URL...`);
            await zohoService.updateDealField(zohoDealId, {
                [ZOHO_SP_FOLDER_FIELD_API_NAME]: folderUrl
            });
            console.log(`✅ Folder URL successfully saved to Zoho.`);
        }

        await ErrorLog.create({ dealId: zohoDealId, logType: 'INFO', stage: 'SHAREPOINT_SYNC_SUCCESS', messages: [`Synced ${uploadedFilesInfo.length} files to folder ${dealName}_${sapId}`] });

    } catch (error) {
        console.error(`\n❌ Error processing Deal ${zohoDealId}:`, error.message);
        await ErrorLog.create({ dealId: zohoDealId, logType: 'ERROR', stage: 'SHAREPOINT_SYNC_FAILED', messages: [error.message] });
    }
};


exports.handleDraftProposalSync = async (req, res) => {
    // Release the webhook immediately to prevent Zoho timeouts
    res.status(202).json({ message: "Draft sync accepted, processing in background." });

    const payload = req.body;
    const zohoDealId = payload.dealId;
    const dealName = payload.dealName || 'Unknown_Deal';
    
    if (!zohoDealId) {
        console.error("Missing Deal ID for Draft Sync.");
        return;
    }

    console.log(`\n--- Draft Proposal Sync Triggered for Deal: ${zohoDealId} ---`);

    try {
        // 1. Get Attachments
        const attachments = await zohoService.getDealAttachments(zohoDealId);
        if (!attachments || attachments.length === 0) {
            console.log(`⚠️ No attachments found for Deal: ${zohoDealId}. Aborting.`);
            return;
        }

        // Assuming you want to sync the most recent attachment 
        // (Or you could add a filter here based on file name, e.g., att.File_Name.includes('Draft'))
        const targetAttachment = attachments[0]; 
        
        console.log(`⬇️ Downloading Draft Proposal: ${targetAttachment.File_Name}`);
        const fileBuffer = await zohoService.downloadAttachment(zohoDealId, targetAttachment.id);

        // 2. Upload to the Draft Proposal Library in SharePoint
        console.log(`⬆️ Uploading to SharePoint Draft Library...`);
        const spUrl = await sharepointService.uploadDraftProposal(
            targetAttachment.File_Name, 
            fileBuffer, 
            dealName, 
            zohoDealId
        );

        // 3. Update the Zoho Deal with the new SharePoint Link
        console.log(`🔗 Updating Zoho Deal with SharePoint link...`);
        await zohoService.updateDealField(zohoDealId, {
            [ZOHO_SP_LINK_FIELD_API_NAME]: spUrl
        });

        console.log(`✅ Draft Proposal Sync Complete for Deal: ${zohoDealId}`);
        await ErrorLog.create({ dealId: zohoDealId, logType: 'INFO', stage: 'DRAFT_SYNC_SUCCESS', messages: [`Successfully synced ${targetAttachment.File_Name}`] });

    } catch (error) {
        console.error(`\n❌ Error processing Draft for Deal ${zohoDealId}:`, error.message);
        await ErrorLog.create({ dealId: zohoDealId, logType: 'ERROR', stage: 'DRAFT_SYNC_FAILED', messages: [error.message] });
    }
};