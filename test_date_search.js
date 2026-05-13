const axios = require('axios'); 
require('dotenv').config(); 

const xmlPayload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global"><soapenv:Header/><soapenv:Body><glob:CustomerQuoteByElementsQuery_sync><CustomerQuoteSelectionByElements><SelectionByID><InclusionExclusionCode>I</InclusionExclusionCode><IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode><LowerBoundaryID>9988</LowerBoundaryID></SelectionByID></CustomerQuoteSelectionByElements></glob:CustomerQuoteByElementsQuery_sync></soapenv:Body></soapenv:Envelope>`; 

axios.post(process.env.SAP_QUOTE_QUERY_URL, xmlPayload, { 
    headers: { 'Content-Type': 'text/xml;charset=utf-8', 'SOAPAction': 'http://sap.com/xi/A1S/Global/QueryCustomerQuoteIn/FindByElementsRequest' }, 
    auth: { username: process.env.SAP_USERNAME, password: process.env.SAP_PASSWORD } 
})
.then(res => {
    const data = res.data;
    const lines = data.split('\n');
    lines.forEach((l, i) => {
        if (l.includes('2026-07-06') || l.includes('2026-07-07') || l.includes('07-07')) {
            console.log('LINE', i, l.trim());
        }
    });
})
.catch(console.error);
