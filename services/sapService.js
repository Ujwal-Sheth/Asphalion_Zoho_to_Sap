const axios = require('axios');
const { parseSapXml } = require('../utils/xmlParser');

/**
 * Validates if an SAP Account ID exists in SAP.
 * @param {string} sapAccountId 
 * @returns {Promise<boolean>}
 */
const checkSapAccountExists = async (sapAccountId) => {
    const xmlPayload = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
       <soapenv:Header/>
       <soapenv:Body>
          <glob:CustomerByIdentificationQuery_sync>
             <CustomerSelectionByIdentification>
                <SelectionByInternalID>
                   <InclusionExclusionCode>I</InclusionExclusionCode>
                   <IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode>
                   <LowerBoundaryInternalID>${sapAccountId}</LowerBoundaryInternalID>
                </SelectionByInternalID>
             </CustomerSelectionByIdentification>
          </glob:CustomerByIdentificationQuery_sync>
       </soapenv:Body>
    </soapenv:Envelope>
    `;

    console.log(`Validating SAP Account ID: ${sapAccountId} using Identification Query...`);

    try {
        const response = await axios.post(process.env.SAP_CUSTOMER_URL, xmlPayload, {
            headers: {
                "Content-Type": "text/xml;charset=utf-8",
                "SOAPAction": "http://sap.com/xi/A1S/Global/QueryCustomerIn/FindByIdentificationRequest", 
            },
            auth: { 
                username: process.env.SAP_USERNAME, 
                password: process.env.SAP_PASSWORD 
            },
        });

        const parsed = await parseSapXml(response.data);
        const resp = parsed?.Envelope?.Body?.CustomerByIdentificationResponse_sync;
        const customers = resp?.Customer;
        
        if (customers) {
            const customerArray = Array.isArray(customers) ? customers : [customers];
            const customer = customerArray[0];
            const accountName = customer.Organisation?.FirstLineName || "Unknown Name";

            console.log(`SUCCESS: Confirmed SAP Account ID ${sapAccountId} is valid. (Account Name: ${accountName})`);
            return true;
        } else {
            console.log(`FAILURE: SAP account ID ${sapAccountId} does not exist in SAP.`);
            return false;
        }

    } catch (err) {
        console.error("SAP Customer Search Error:", err.response?.data || err.message);
        throw err; 
    }
};

/**
 * Fetches RAW SAP Quote details by Quote ID.
 * @param {string} sapQuoteId 
 * @returns {Promise<Object|null>}
 */
const getSapQuoteDetails = async (sapQuoteId) => {
    const xmlPayload = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
       <soapenv:Header/>
       <soapenv:Body>
          <glob:CustomerQuoteByElementsQuery_sync>
             <CustomerQuoteSelectionByElements>
                <SelectionByID>
                   <InclusionExclusionCode>I</InclusionExclusionCode>
                   <IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode>
                   <LowerBoundaryID>${sapQuoteId}</LowerBoundaryID>
                </SelectionByID>
             </CustomerQuoteSelectionByElements>
          </glob:CustomerQuoteByElementsQuery_sync>
       </soapenv:Body>
    </soapenv:Envelope>
    `;

    try {
        const response = await axios.post(process.env.SAP_QUOTE_QUERY_URL, xmlPayload, {
            headers: {
                "Content-Type": "text/xml;charset=utf-8",
                "SOAPAction": "http://sap.com/xi/A1S/Global/QueryCustomerQuoteIn/FindByElementsRequest", 
            },
            auth: { 
                username: process.env.SAP_USERNAME, 
                password: process.env.SAP_PASSWORD 
            },
        });

        const parsed = await parseSapXml(response.data);
        const quoteData = parsed?.Envelope?.Body?.CustomerQuoteByElementsResponse_sync?.CustomerQuote;
        
        if (!quoteData) return null;

        const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData;
        return quote;

    } catch (err) {
        console.error(`Error fetching SAP Quote ${sapQuoteId}:`, err.message);
        return null;
    }
};

/**
 * Posts a Sales Quote payload to SAP ByDesign.
 * @param {string} soapPayload 
 * @returns {Promise<Object>} An object containing sapQuoteId, sapMessages, and rawResponse
 */
const postSapQuote = async (soapPayload) => {
    const response = await axios.post(
        process.env.SAP_QUOTE_URL,
        soapPayload,
        {
            auth: {
                username: process.env.SAP_USERNAME,
                password: process.env.SAP_PASSWORD,
            },
            headers: {
                "Content-Type": "application/soap+xml;charset=UTF-8",
                "SOAPAction": "http://sap.com/xi/A1S/Global/ManageCustomerQuoteIn/MaintainBundle_V1Request",
                Accept: "application/soap+xml",
            },
            timeout: 30000,
        }
    );

    const parsedResponse = await parseSapXml(response.data);
    const confirmation = parsedResponse?.Envelope?.Body?.CustomerQuoteBundleMaintainConfirmation_sync;
    const sapQuoteId = confirmation?.CustomerQuote?.ID || null;

    let sapMessages = [];
    const log = confirmation?.Log;
    if (log && log.Item) {
        const logItems = Array.isArray(log.Item) ? log.Item : [log.Item];
        sapMessages = logItems.map((item) => item.Note);
    }

    return { sapQuoteId, sapMessages, rawResponse: response.data, parsedResponse };
};

module.exports = { 
    checkSapAccountExists, 
    getSapQuoteDetails,
    postSapQuote
};
