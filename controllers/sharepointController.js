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
        const dealCode = dealData.Deal_Code || '';

        if (!dealData.Account_Name || !dealData.Account_Name.id) {
            throw new Error("No Account linked to this Deal. Cannot fetch SAP ID.");
        }

        const acceptanceType = dealData.Acceptance_Type || '';
        let targetSubFolder = ''; 

        if (acceptanceType === 'Master Agreement (MSA)') {
            targetSubFolder = 'Contracts';
        } else if (acceptanceType === 'CDA') {
            targetSubFolder = 'CDAs';
        } else if (['Zoho Signature', 'Email', 'Purchase Order (PO)'].includes(acceptanceType)) {
            targetSubFolder = 'Proposals';
        } else {
            console.log(`⚠️ Unrecognized or empty Acceptance Type: '${acceptanceType}'. Aborting sync.`);
            await ErrorLog.create({ 
                dealId: zohoDealId, 
                logType: 'INFO', 
                stage: 'SHAREPOINT_SYNC_SKIPPED', 
                messages: [`Unrecognized Acceptance Type: '${acceptanceType}'. Files intentionally left in Zoho.`] 
            });
            return;
        }

        console.log(`[2/4] Fetching Account data to extract SAP ID...`);
        const accountData = await zohoService.getRecord('Accounts', dealData.Account_Name.id);

        const sapId = accountData.SAP_Customer_ID;
        const accountName = accountData.Account_Name || dealData.Account_Name.name || "Unknown_Account";

        if (!sapId) {
            console.log(`⚠️ Client is a prospect (No SAP Code). Documents remain in Zoho cloud.`);
            await ErrorLog.create({ 
                dealId: zohoDealId, 
                logType: 'INFO', 
                stage: 'SHAREPOINT_SYNC_SKIPPED', 
                messages: ['Client is a prospect. Files intentionally left in Zoho.'] 
            });
            return;
        }

        console.log(`✅ Extracted SAP ID: ${sapId}`);
        console.log(`✅ Acceptance Type resolved to Folder: BD/${targetSubFolder}`);

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
            
               // --- Apply New Naming Convention ---
            // 1. Generate YYMMDD string
            const rawAttDate = att.Created_Time || att.CreatedTime || att.File_Uploaded_Time || att.Modified_Time;
            let attDate = att.Created_Time ? new Date(att.Created_Time) : null;

            if (!attDate || isNaN(attDate.getTime())) {
                console.warn(`⚠️ Could not resolve attachment date for "${att.File_Name}" (id: ${att.id}). Falling back to today's date.`);
                attDate = new Date();
            }

            const yy = String(attDate.getFullYear()).slice(-2);
            const mm = String(attDate.getMonth() + 1).padStart(2, '0');
            const dd = String(attDate.getDate()).padStart(2, '0');
            const datePrefix = `${yy}${mm}${dd}`;

            // const today = new Date();
            // const yy = String(today.getFullYear()).slice(-2);
            // const mm = String(today.getMonth() + 1).padStart(2, '0');
            // const dd = String(today.getDate()).padStart(2, '0');
            // const datePrefix = `${yy}${mm}${dd}`;

            // 2. Separate the base name from the extension to avoid appending text after '.pdf'
            const originalFileName = att.File_Name;
            const lastDotIndex = originalFileName.lastIndexOf('.');
            const baseName = lastDotIndex !== -1 ? originalFileName.substring(0, lastDotIndex) : originalFileName;
            const extension = lastDotIndex !== -1 ? originalFileName.substring(lastDotIndex) : '';

            // 3. Construct the final file name: YYMMDD_[original]_[client]_Asphalion_final_fully signed
            const newFileName = `${datePrefix}_${baseName}_${accountName}_Asphalion_final_fully signed${extension}`;

            console.log(`⬆️ Uploading to SharePoint -> Projects/[Account]/BD/${targetSubFolder}/[DealName]/${newFileName}...`);

            const spUrl = await sharepointService.uploadFileToSharePoint(
                newFileName, 
                fileBuffer,
                targetSubFolder,
                sapId,
                accountName,
                dealName,
                dealCode
            );
            uploadedFilesInfo.push({ fileName: att.File_Name, sharepointUrl: spUrl });
        }

        console.log(`\n[4/4] SHAREPOINT SYNC COMPLETE`);

        // --- Push Folder URL back to Zoho ---
        if (uploadedFilesInfo.length > 0) {
            let firstFileUrl = uploadedFilesInfo[0].sharepointUrl;
            let folderUrl = firstFileUrl.split('?')[0];
            // Navigates up two directories to capture the parent "bd" folder, not the specific subfolder
            folderUrl = folderUrl.substring(0, folderUrl.lastIndexOf('/'));

            console.log(`🔗 Updating Zoho Deal with SharePoint Folder URL...`);
            await zohoService.updateDealField(zohoDealId, {
                [ZOHO_SP_FOLDER_FIELD_API_NAME]: folderUrl
            });
            console.log(`✅ Folder URL successfully saved to Zoho.`);
        }

        await ErrorLog.create({ dealId: zohoDealId, logType: 'INFO', stage: 'SHAREPOINT_SYNC_SUCCESS', messages: [`Synced ${uploadedFilesInfo.length} files to ${targetSubFolder} for SAP ID ${sapId}`] });

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
        // Fetch Deal to get Deal_Name, Deal_Code, and Account ID
        const dealData = await zohoService.getRecord('Deals', zohoDealId);
        const actualDealName = dealData.Deal_Name || '';
        const dealCode = dealData.Deal_Code || '';

        let sapCustomerId = '';
        if (dealData.Account_Name && dealData.Account_Name.id) {
            const accountData = await zohoService.getRecord('Accounts', dealData.Account_Name.id);
            sapCustomerId = accountData.SAP_Customer_ID || '';
        }

        // const expectedNamePart = `${actualDealName.replace(/ /g, '_').replace(/\//g, '-').replaceAll("%","_porciento")}_${dealCode}_${sapCustomerId}`;
        const expectedNamePart = `${dealCode}_${sapCustomerId}_${actualDealName.replaceAll(/ /g, '_').replaceAll(/\//g, '-').replaceAll("%","_porciento")}`;

        // 1. Get Attachments
        const attachments = await zohoService.getDealAttachments(zohoDealId);
        if (!attachments || attachments.length === 0) {
            console.log(`⚠️ No attachments found for Deal: ${zohoDealId}. Aborting.`);
            return;
        }

        // Filter to only include the pdf file whose name contains the expected name part or the old Draft_Deal_Contract convention
        const targetAttachment = attachments.find(att =>
            att.File_Name &&
            (att.File_Name.includes(expectedNamePart) || att.File_Name.includes('Draft_Deal_Contract')) &&
            att.File_Name.toLowerCase().endsWith('.pdf')
        );

        if (!targetAttachment) {
            console.log(`⚠️ No PDF attachment containing '${expectedNamePart}' or 'Draft_Deal_Contract' found for Deal: ${zohoDealId}. Aborting.`);
            return;
        }

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