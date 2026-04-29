const zohoService = require('../services/zohoService');
const sapService = require('../services/sapService');
const ErrorLog = require("../models/errorLogModel");
const { buildSapXmlPayload } = require("../utils/xmlBuilder");
const { getCurrentIsoDateTimeForZoho } = require("../utils/dateUtils");

const logToMongo = async (
  dealId,
  accountId,
  sapQuoteId,
  logType,
  stage,
  messages,
  rawPayload,
) => {
  try {
    await ErrorLog.create({
      dealId,
      accountId,
      sapQuoteId,
      logType,
      stage,
      messages: Array.isArray(messages) ? messages : [messages],
      rawPayload,
    });
    console.log(`[DB] Logged ${logType} to MongoDB for Deal ${dealId}`);
  } catch (dbError) {
    console.error("CRITICAL: Failed to save to MongoDB", dbError.message);
  }
};

exports.syncDealToSap = async (req, res) => {
  const dealId = req.params.dealId;
  let zohoDealData = null;
  let sapAccountId = null; 
  let soapPayload = null;

  try {
    // --- STEP 1: Fetch Deal from Zoho ---
    console.log(`[1/4] Fetching Deal ${dealId} from Zoho...`);
    zohoDealData = await zohoService.getRecord('Deals', dealId);

    const existingQuoteId = zohoDealData.SAP_Offer_Code || null; 
    
    if (existingQuoteId) {
      console.warn(`[!] BLOCKING: Deal ${dealId} already has an SAP Quote ID (${existingQuoteId}).`);
      await logToMongo(dealId, null, existingQuoteId, "WARNING", "BLOCKED_QUOTE_ALREADY_EXISTS", `Deal already synced with SAP Quote: ${existingQuoteId}`, { dealId });
      
      try {
        console.log(`Pushing already exists status back to Zoho Deal ${dealId}...`);
        await zohoService.updateDealField(dealId, {
          SAP_Shipment_Status: "Error",
          SAP_Error_Message: "Process stopped: SAP Quote already exists for this Deal.",
          SAP_Shipment_Date: getCurrentIsoDateTimeForZoho(),
        });
        console.log(`SUCCESS: Zoho Deal updated with already exists message.`);
      } catch (zohoError) {
        console.error(`Failed to update Zoho with existing quote status:\n`, zohoError.message);
      }

      return res.status(400).json({
        success: false,
        message: "Process stopped: SAP Quote already exists for this Deal.",
        existingQuoteId: existingQuoteId
      });
    }

    // --- STEP 1.5: Fetch related Account to get SAP ID ---
    if (!zohoDealData.Account_Name || !zohoDealData.Account_Name.id) {
      throw new Error("No Account linked to this Deal.");
    }
    
    console.log(`[1.5/4] Fetching related Account from Zoho...`);
    const zohoAccountData = await zohoService.getRecord('Accounts', zohoDealData.Account_Name.id);

    sapAccountId = zohoAccountData.SAP_Customer_ID || null;

    if (!sapAccountId) {
      throw new Error("No SAP Customer ID found on the related Zoho Account.");
    }

  } catch (error) {
    await logToMongo(dealId, null, null, "ERROR", "ZOHO_FETCH_ERROR", error.message, { dealId });
    return res.status(500).json({
      success: false,
      message: "Failed fetching Zoho data",
      error: error.message,
    });
  }

  try {
    // --- STEP 2: Validate SAP Account ID ---
    console.log(`[2/4] Verifying SAP ID ${sapAccountId} in SAP ByDesign...`);
    const isValid = await sapService.checkSapAccountExists(sapAccountId);
    
    if (!isValid) {
      throw new Error(`The SAP Customer ID provided (${sapAccountId}) does not exist in the SAP database.`);
    }
  } catch (error) {
    await logToMongo(dealId, sapAccountId, null, "ERROR", "SAP_ACCOUNT_VALIDATION_ERROR", error.message, { sapAccountId });
    return res.status(500).json({
      success: false,
      message: "SAP Account validation failed",
      error: error.message,
    });
  }

  try {
    // --- STEP 3: Transform to XML ---
    console.log(`[3/4] Transforming Zoho JSON to SAP XML...`);
    soapPayload = buildSapXmlPayload(zohoDealData, sapAccountId);
  } catch (error) {
    await logToMongo(dealId, sapAccountId, null, "ERROR", "XML_BUILD_ERROR", error.message, zohoDealData);
    return res.status(500).json({
      success: false,
      message: "Failed building XML",
      error: error.message,
    });
  }

  try {
    // --- STEP 4: Post Quote to SAP ---
    console.log(`[4/4] Sending Sales Quote to SAP ByDesign...`);
    const sapResult = await sapService.postSapQuote(soapPayload);
    const { sapQuoteId, sapMessages, rawResponse } = sapResult;

    if (!sapQuoteId) {
      console.error(`[!] SAP rejected the Quote. No Quote ID generated.`);
      await logToMongo(dealId, sapAccountId, null, "ERROR", "SAP_QUOTE_CREATION_FAILED", sapMessages, rawResponse);

      try {
        console.log(`Pushing error status back to Zoho Deal ${dealId}...`);
        const combinedErrors = sapMessages.join(" | ").substring(0, 2000);
        
        await zohoService.updateDealField(dealId, {
          SAP_Shipment_Status: "Error",
          SAP_Error_Message: combinedErrors,
          SAP_Shipment_Date: getCurrentIsoDateTimeForZoho(),
        });
        console.log(`SUCCESS: Zoho Deal updated with SAP Error messages.`);
      } catch (zohoError) {
        console.error(`Failed to update Zoho with Error status:\n`, zohoError.message);
      }
      
      return res.status(400).json({
        success: false,
        message: "Not synced to SAP",
        accountIdUsed: sapAccountId,
        sapQuoteId: null,
        sapErrors: sapMessages, 
      });
    }

    if (sapMessages.length > 0) {
      console.log(`[!] SAP created Quote ${sapQuoteId} but returned ${sapMessages.length} warning(s).`);
      await logToMongo(dealId, sapAccountId, sapQuoteId, "WARNING", "SAP_QUOTE_CREATED_WITH_WARNINGS", sapMessages, rawResponse);
    } else {
      console.log(`SUCCESS! Quote ${sapQuoteId} created in SAP cleanly.`);
    }

    // --- PUSH SUCCESS STATUS BACK TO ZOHO ---
    try {
      console.log(`Pushing success status and Quote ID back to Zoho Deal ${dealId}...`);
      await zohoService.updateDealField(dealId, {
        SAP_Shipment_Status: "OK", 
        SAP_Error_Message: null,           
        SAP_Shipment_Date: getCurrentIsoDateTimeForZoho(),
        SAP_Offer_Code: sapQuoteId         
      });
      console.log(`SUCCESS: Zoho Deal updated with SAP Quote ID ${sapQuoteId}.`);
    } catch (zohoError) {
      console.error(`Failed to update Zoho with Success status:\n`, zohoError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Successfully synced Deal to SAP",
      accountIdUsed: sapAccountId,
      sapQuoteId: sapQuoteId,
      sapWarnings: sapMessages,
    });
  } catch (error) {
    let errorMessages = [error.message];
    if (error.response && error.response.data) {
        errorMessages = ["SAP API rejected the payload (Raw XML error recorded in database)"];
    }

    await logToMongo(dealId, sapAccountId, null, "ERROR", "SAP_POST_ERROR", errorMessages, error.response?.data || soapPayload);
    return res.status(500).json({
      success: false,
      message: "Failed to post Quote to SAP",
      errors: errorMessages,
    });
  }
};

//Wrapper function to handle the POST webhook
exports.handleWebhook = async (req, res) => {
  res.status(200).json({ message: "Webhook received. Processing in background." });
  const dealId = req.body.dealId;

  if (!dealId) {
    console.error("Webhook received but no Deal ID was found in the payload.");
    return;
  }

  console.log(`\n--- WEBHOOK TRIGGERED FOR DEAL: ${dealId} ---`);

  const mockReq = { params: { dealId: dealId } };
  const mockRes = {
    status: () => ({
      json: (data) => console.log("Background Sync Result:", data.message),
    }),
  };

  await exports.syncDealToSap(mockReq, mockRes);
};