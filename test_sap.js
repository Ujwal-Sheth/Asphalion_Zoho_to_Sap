const axios = require('axios'); 
require('dotenv').config(); 

const xmlPayload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global"><soapenv:Header/><soapenv:Body><glob:CustomerQuoteByElementsQuery_sync><CustomerQuoteSelectionByElements><SelectionByID><InclusionExclusionCode>I</InclusionExclusionCode><IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode><LowerBoundaryID>9988</LowerBoundaryID></SelectionByID></CustomerQuoteSelectionByElements><CustomerQuoteRequestedElements><CustomerQuoteTransmissionRequestCode>1</CustomerQuoteTransmissionRequestCode></CustomerQuoteRequestedElements></glob:CustomerQuoteByElementsQuery_sync></soapenv:Body></soapenv:Envelope>`; 

axios.post(process.env.SAP_QUOTE_QUERY_URL, xmlPayload, { 
    headers: { 'Content-Type': 'text/xml;charset=utf-8', 'SOAPAction': 'http://sap.com/xi/A1S/Global/QueryCustomerQuoteIn/FindByElementsRequest' }, 
    auth: { username: process.env.SAP_USERNAME, password: process.env.SAP_PASSWORD } 
})
.then(res => {
    const data = res.data;
    if (data.includes('Validity')) {
        const index = data.indexOf('Validity');
        console.log(data.substring(Math.max(0, index - 50), index + 200));
    } else {
        console.log('Not found');
    }
})
.catch(console.error);
