const axios = require('axios'); 
require('dotenv').config(); 

const xmlPayload = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
   <soap:Header/>
   <soap:Body>
      <glob:CustomerQuoteBundleReadRequest_sync>
         <CustomerQuote>
            <ID>9988</ID>
         </CustomerQuote>
      </glob:CustomerQuoteBundleReadRequest_sync>
   </soap:Body>
</soap:Envelope>`; 

axios.post(process.env.SAP_QUOTE_URL, xmlPayload, { 
    headers: { 'Content-Type': 'application/soap+xml;charset=UTF-8', 'SOAPAction': 'http://sap.com/xi/A1S/Global/ManageCustomerQuoteIn/ReadBundle_V1Request' }, 
    auth: { username: process.env.SAP_USERNAME, password: process.env.SAP_PASSWORD } 
})
.then(res => {
    const data = res.data;
    if (data.includes('ValidityPeriod')) {
        console.log('FOUND ValidityPeriod!');
        const index = data.indexOf('ValidityPeriod');
        console.log(data.substring(Math.max(0, index - 50), index + 200));
    } else {
        console.log('Not found');
    }
})
.catch(console.error);
