require('dotenv').config();
const axios = require('axios');
const { parseSapXml } = require('../utils/xmlParser');

const request = async (xml, action) => {
  const response = await axios.post(process.env.SAP_CUSTOMER_URL, xml, {
    headers: {
      'Content-Type': 'text/xml;charset=utf-8',
      'SOAPAction': action,
    },
    auth: {
      username: process.env.SAP_USERNAME,
      password: process.env.SAP_PASSWORD,
    },
    timeout: 120000,
  });
  return parseSapXml(response.data);
};

const extractIds = (customers) => {
  if (!customers) return [];
  const arr = Array.isArray(customers) ? customers : [customers];
  return arr.map(c => c?.InternalID?._ || c?.InternalID || null).filter(Boolean);
};

const buildQuery = (lowerId, code) => `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
   <soapenv:Header/>
   <soapenv:Body>
      <glob:CustomerByIdentificationQuery_sync>
         <CustomerSelectionByIdentification>
            <SelectionByInternalID>
               <InclusionExclusionCode>I</InclusionExclusionCode>
               <IntervalBoundaryTypeCode>${code}</IntervalBoundaryTypeCode>
               <LowerBoundaryInternalID>${lowerId}</LowerBoundaryInternalID>
            </SelectionByInternalID>
         </CustomerSelectionByIdentification>
      </glob:CustomerByIdentificationQuery_sync>
   </soapenv:Body>
</soapenv:Envelope>`;

(async () => {
  try {
    const firstXml = buildQuery('*', 1);
    const firstParsed = await request(firstXml, 'http://sap.com/xi/A1S/Global/QueryCustomerIn/FindByIdentificationRequest');
    const firstCustomers = firstParsed?.Envelope?.Body?.CustomerByIdentificationResponse_sync?.Customer;
    const firstArr = Array.isArray(firstCustomers) ? firstCustomers : firstCustomers ? [firstCustomers] : [];
    const firstIds = extractIds(firstArr);
    console.log('FIRST_PAGE_COUNT', firstArr.length);
    console.log('FIRST_PAGE_LAST_ID', firstIds.slice(-1)[0]);

    const boundary = firstIds.slice(-1)[0];
    if (!boundary) return;

    for (const code of [1, 2, 3]) {
      const secondXml = buildQuery(boundary, code);
      const secondParsed = await request(secondXml, 'http://sap.com/xi/A1S/Global/QueryCustomerIn/FindByIdentificationRequest');
      const secondCustomers = secondParsed?.Envelope?.Body?.CustomerByIdentificationResponse_sync?.Customer;
      const secondArr = Array.isArray(secondCustomers) ? secondCustomers : secondCustomers ? [secondCustomers] : [];
      const secondIds = extractIds(secondArr);
      console.log(`SECOND_PAGE_CODE_${code}_COUNT`, secondArr.length);
      console.log(`SECOND_PAGE_CODE_${code}_FIRST_ID`, secondIds[0]);
      console.log(`SECOND_PAGE_CODE_${code}_LAST_ID`, secondIds.slice(-1)[0]);
      console.log(`SECOND_PAGE_CODE_${code}_FIRST_10`, secondIds.slice(0, 10));
    }
  } catch (err) {
    console.error('ERROR', err.response?.data || err.message || err);
    process.exit(1);
  }
})();
