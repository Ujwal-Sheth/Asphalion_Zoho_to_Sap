const axios = require('axios'); 
const xml2js = require('xml2js');
require('dotenv').config(); 

const xmlPayload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global"><soapenv:Header/><soapenv:Body><glob:CustomerQuoteByElementsQuery_sync><CustomerQuoteSelectionByElements><SelectionByID><InclusionExclusionCode>I</InclusionExclusionCode><IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode><LowerBoundaryID>9988</LowerBoundaryID></SelectionByID></CustomerQuoteSelectionByElements></glob:CustomerQuoteByElementsQuery_sync></soapenv:Body></soapenv:Envelope>`; 

axios.post(process.env.SAP_QUOTE_QUERY_URL, xmlPayload, { 
    headers: { 'Content-Type': 'text/xml;charset=utf-8', 'SOAPAction': 'http://sap.com/xi/A1S/Global/QueryCustomerQuoteIn/FindByElementsRequest' }, 
    auth: { username: process.env.SAP_USERNAME, password: process.env.SAP_PASSWORD } 
})
.then(res => {
    xml2js.parseString(res.data, { explicitArray: false, ignoreAttrs: false }, (err, result) => {
        const quote = result['soap-env:Envelope']['soap-env:Body']['n0:CustomerQuoteByElementsResponse_sync']['CustomerQuote'];
        const keys = Object.keys(quote);
        const periodKeys = keys.filter(k => k.includes('PeriodTerms') || k.includes('Validity') || k.includes('Date'));
        console.log('Found Date/Period Keys:', periodKeys);
        periodKeys.forEach(k => console.log(k, JSON.stringify(quote[k])));
    });
})
.catch(console.error);
