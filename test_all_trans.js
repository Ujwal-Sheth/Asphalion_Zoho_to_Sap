const axios = require('axios'); 
require('dotenv').config(); 

async function test(code) {
    const xmlPayload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global"><soapenv:Header/><soapenv:Body><glob:CustomerQuoteByElementsQuery_sync><CustomerQuoteSelectionByElements><SelectionByID><InclusionExclusionCode>I</InclusionExclusionCode><IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode><LowerBoundaryID>9988</LowerBoundaryID></SelectionByID></CustomerQuoteSelectionByElements><CustomerQuoteRequestedElements><CustomerQuoteTransmissionRequestCode>${code}</CustomerQuoteTransmissionRequestCode></CustomerQuoteRequestedElements></glob:CustomerQuoteByElementsQuery_sync></soapenv:Body></soapenv:Envelope>`; 
    try {
        const res = await axios.post(process.env.SAP_QUOTE_QUERY_URL, xmlPayload, { 
            headers: { 'Content-Type': 'text/xml;charset=utf-8', 'SOAPAction': 'http://sap.com/xi/A1S/Global/QueryCustomerQuoteIn/FindByElementsRequest' }, 
            auth: { username: process.env.SAP_USERNAME, password: process.env.SAP_PASSWORD } 
        });
        if (res.data.includes('Validity')) {
            console.log(`Code ${code} FOUND ValidityPeriod!`);
            return true;
        } else {
            console.log(`Code ${code} Not found`);
        }
    } catch(e) {
        console.log(`Code ${code} Error`, e.message);
    }
    return false;
}

async function runAll() {
    for (let i = 1; i <= 5; i++) {
        await test(i);
    }
}
runAll();
