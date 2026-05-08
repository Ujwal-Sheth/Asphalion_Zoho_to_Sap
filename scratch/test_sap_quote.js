require('dotenv').config();
const axios = require('axios');
const xml2js = require('xml2js');

async function testQuoteQuery(sapQuoteId) {
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

    // Using the same SAP domain you used in the customer test
    // Usually it is something like /sap/bc/srt/scs/sap/querycustomerquotein1
    // You can also change this to process.env.SAP_QUOTE_QUERY_URL if you prefer
    const SAP_QUOTE_URL = "https://my354055.sapbydesign.com/sap/bc/srt/scs/sap/querycustomerquotein";

    console.log(`Searching for Sales Quote ID: ${sapQuoteId} ...\n`);

    try {
        const response = await axios.post(SAP_QUOTE_URL, xmlPayload, {
            headers: {
                "Content-Type": "text/xml;charset=utf-8",
                "SOAPAction": "http://sap.com/xi/A1S/Global/QueryCustomerQuoteIn/FindByElementsRequest", 
            },
            auth: { 
                username: process.env.SAP_USERNAME, 
                password: process.env.SAP_PASSWORD 
            },
        });

        const parsed = await xml2js.parseStringPromise(response.data, { explicitArray: false, ignoreAttrs: false });
        console.log(JSON.stringify(parsed, null, 2));

    } catch (err) {
        console.error("Error connecting to SAP:", err.response?.data || err.message);
    }
}

// You can change '11006' to whatever Quote ID you want to test!
testQuoteQuery('873');
