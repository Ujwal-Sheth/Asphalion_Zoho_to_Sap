require('dotenv').config();
const axios = require('axios');
const xml2js = require('xml2js');

async function testCustomerQuery(sapAccountId) {
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

    const SAP_CUSTOMER_URL = "https://my354055.sapbydesign.com/sap/bc/srt/scs/sap/querycustomerin1";

    console.log(`Searching for Customer ID: ${sapAccountId} ...\n`);

    try {
        const response = await axios.post(SAP_CUSTOMER_URL, xmlPayload, {
            headers: {
                "Content-Type": "text/xml;charset=utf-8",
                "SOAPAction": "http://sap.com/xi/A1S/Global/QueryCustomerIn/FindByIdentificationRequest", 
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

// You can change '6498' to whatever customer ID you want to test!
testCustomerQuery('ISGL');
