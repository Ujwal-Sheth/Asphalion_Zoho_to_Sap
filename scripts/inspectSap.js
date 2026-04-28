require('dotenv').config(); 
const axios = require('axios');
const xml2js = require('xml2js');

const inspectSapQuote = async (sapQuoteId) => {
    console.log(`\n📡 Fetching RAW data from SAP for Quote ID: ${sapQuoteId}...`);

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

        const parsed = await xml2js.parseStringPromise(response.data, {
            explicitArray: false,
            tagNameProcessors: [xml2js.processors.stripPrefix] 
        });

        const quoteData = parsed?.Envelope?.Body?.CustomerQuoteByElementsResponse_sync?.CustomerQuote;
        
        if (!quoteData) {
            console.log("⚠️ No quote found. SAP returned an empty response or an error.");
            return;
        }

        const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData;

        console.log("\n==========================================");
        console.log(`         RAW SAP DATA FOR ${sapQuoteId}         `);
        console.log("==========================================\n");

        // The { depth: null } parameter forces Node.js to print every single nested 
        // object and array, instead of hiding them behind "[Object]" tags.
        console.dir(quote, { depth: null, colors: true });

        console.log("\n==========================================\n");

    } catch (err) {
        console.error(`❌ Error fetching SAP Quote:`, err.message);
    }
};

// --- RUN THE INSPECTOR ---
// Change this ID to whatever quote you want to look up
inspectSapQuote('8142');