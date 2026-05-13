const axios = require('axios'); 
require('dotenv').config(); 

async function getQuoteFull() {
    // 1. Get UUID
    const queryXml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global"><soapenv:Header/><soapenv:Body><glob:CustomerQuoteByElementsQuery_sync><CustomerQuoteSelectionByElements><SelectionByID><InclusionExclusionCode>I</InclusionExclusionCode><IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode><LowerBoundaryID>10188</LowerBoundaryID></SelectionByID></CustomerQuoteSelectionByElements></glob:CustomerQuoteByElementsQuery_sync></soapenv:Body></soapenv:Envelope>`; 
    
    let uuid = null;
    try {
        const resQuery = await axios.post(process.env.SAP_QUOTE_QUERY_URL, queryXml, { 
            headers: { 'Content-Type': 'text/xml;charset=utf-8', 'SOAPAction': 'http://sap.com/xi/A1S/Global/QueryCustomerQuoteIn/FindByElementsRequest' }, 
            auth: { username: process.env.SAP_USERNAME, password: process.env.SAP_PASSWORD } 
        });
        const match = resQuery.data.match(/<UUID[^>]*>([^<]+)<\/UUID>/);
        if (match) {
            uuid = match[1];
            console.log('Found UUID:', uuid);
        } else {
            console.log('UUID not found in query');
            return;
        }
    } catch(e) {
        console.error('Query Error:', e.message);
        return;
    }

    // 2. ReadBundle with UUID
    const readXml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
       <soapenv:Header/>
       <soapenv:Body>
          <glob:CustomerQuoteBundleReadRequest_sync>
             <CustomerQuote>
                <UUID>${uuid}</UUID>
             </CustomerQuote>
          </glob:CustomerQuoteBundleReadRequest_sync>
       </soapenv:Body>
    </soapenv:Envelope>`; 
    
    try {
        const resRead = await axios.post(process.env.SAP_QUOTE_URL, readXml, { 
            headers: { 'Content-Type': 'text/xml;charset=UTF-8', 'SOAPAction': 'http://sap.com/xi/A1S/Global/ManageCustomerQuoteIn/ReadBundle_V1Request' }, 
            auth: { username: process.env.SAP_USERNAME, password: process.env.SAP_PASSWORD } 
        });
        
        console.log("ReadBundle Success!");
        if (resRead.data.includes('Validity')) {
            console.log("Found Validity!");
            const idx = resRead.data.indexOf('Validity');
            console.log(resRead.data.substring(Math.max(0, idx - 50), idx + 200));
        } else {
            console.log("Validity STILL not found in ReadBundle");
        }
    } catch(e) {
        console.error('ReadBundle Error:', e.response ? e.response.data : e.message);
    }
}

getQuoteFull();
