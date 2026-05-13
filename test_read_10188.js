const axios = require('axios'); 
require('dotenv').config(); 

const xmlPayload = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
   <soapenv:Header/>
   <soapenv:Body>
      <glob:CustomerQuoteBundleReadRequest_sync>
         <CustomerQuote>
            <ID>10188</ID>
         </CustomerQuote>
      </glob:CustomerQuoteBundleReadRequest_sync>
   </soapenv:Body>
</soapenv:Envelope>`; 

axios.post(process.env.SAP_QUOTE_URL, xmlPayload, { 
    headers: { 'Content-Type': 'text/xml;charset=UTF-8', 'SOAPAction': 'http://sap.com/xi/A1S/Global/ManageCustomerQuoteIn/ReadBundle_V1Request' }, 
    auth: { username: process.env.SAP_USERNAME, password: process.env.SAP_PASSWORD } 
})
.then(res => {
    console.log("SUCCESS:", res.status);
    console.log(res.data.substring(0, 1000));
})
.catch(err => {
    console.error("ERROR:", err.response ? err.response.data : err.message);
});
