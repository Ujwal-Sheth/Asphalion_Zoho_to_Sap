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
  });
  const parsed = await parseSapXml(response.data);
  return parsed;
};

const formatCount = (parsed, path) => {
  const value = path.reduce((obj, key) => (obj && obj[key] ? obj[key] : null), parsed);
  if (!value) return 0;
  return Array.isArray(value) ? value.length : 1;
};

(async () => {
  try {
    const roleQuery = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
       <soapenv:Header/>
       <soapenv:Body>
          <glob:CustomerByIdentificationQuery_sync>
             <CustomerSelectionByIdentification>
                <SelectionByRoleCode>
                   <InclusionExclusionCode>I</InclusionExclusionCode>
                   <IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode>
                   <LowerBoundaryRoleCode>CRM000</LowerBoundaryRoleCode>
                </SelectionByRoleCode>
             </CustomerSelectionByIdentification>
          </glob:CustomerByIdentificationQuery_sync>
       </soapenv:Body>
    </soapenv:Envelope>`;

    const internalQuery = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
       <soapenv:Header/>
       <soapenv:Body>
          <glob:CustomerByIdentificationQuery_sync>
             <CustomerSelectionByIdentification>
                <SelectionByInternalID>
                   <InclusionExclusionCode>I</InclusionExclusionCode>
                   <IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode>
                   <LowerBoundaryInternalID>*</LowerBoundaryInternalID>
                </SelectionByInternalID>
             </CustomerSelectionByIdentification>
          </glob:CustomerByIdentificationQuery_sync>
       </soapenv:Body>
    </soapenv:Envelope>`;

    const byRole = await request(roleQuery, 'http://sap.com/xi/A1S/Global/QueryCustomerIn/FindByIdentificationRequest');
    const byInternal = await request(internalQuery, 'http://sap.com/xi/A1S/Global/QueryCustomerIn/FindByIdentificationRequest');

    const roleCount = formatCount(byRole, ['Envelope','Body','CustomerByIdentificationResponse_sync','Customer']);
    const internalCount = formatCount(byInternal, ['Envelope','Body','CustomerByIdentificationResponse_sync','Customer']);

    console.log('ROLE_QUERY_COUNT', roleCount);
    console.log('INTERNAL_QUERY_COUNT', internalCount);

    const byElements = await request(`
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
       <soapenv:Header/>
       <soapenv:Body>
          <glob:CustomerByElementsQuery_sync>
             <CustomerSelectionByElements>
                <SelectionByInternalID>
                   <InclusionExclusionCode>I</InclusionExclusionCode>
                   <IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode>
                   <LowerBoundaryInternalID>*</LowerBoundaryInternalID>
                </SelectionByInternalID>
             </CustomerSelectionByElements>
             <CustomerRequestedElements>
                <ContactPersonTransmissionRequestCode>1</ContactPersonTransmissionRequestCode>
             </CustomerRequestedElements>
          </glob:CustomerByElementsQuery_sync>
       </soapenv:Body>
    </soapenv:Envelope>
    `, 'http://sap.com/xi/A1S/Global/QueryCustomerIn/FindByElementsRequest');

    const elementsCount = formatCount(byElements, ['Envelope','Body','CustomerByElementsResponse_sync','Customer']);
    console.log('ELEMENTS_QUERY_COUNT', elementsCount);
  } catch (err) {
    console.error('ERROR', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
