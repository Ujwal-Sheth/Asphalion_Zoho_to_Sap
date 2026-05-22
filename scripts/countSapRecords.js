require('dotenv').config();
const axios = require('axios');
const { parseSapXml } = require('../utils/xmlParser'); // Adjust path as needed
const logger = require('../utils/logger');             // Adjust path as needed

const countSapAccounts = async () => {
    logger.info("Starting lightweight count for SAP Accounts...");
    let totalAccounts = 0;
    let lastObjectId = null;
    let hasMore = true;

    while (hasMore) {
        const paginationNode = lastObjectId 
            ? `<LastReturnedObjectID>${lastObjectId}</LastReturnedObjectID>` 
            : '';

        const xmlPayload = `
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
                 <ProcessingConditions>
                    <QueryHitsMaximumNumberValue>500</QueryHitsMaximumNumberValue>
                    <QueryHitsUnlimitedIndicator>false</QueryHitsUnlimitedIndicator>
                    ${paginationNode}
                 </ProcessingConditions>
              </glob:CustomerByIdentificationQuery_sync>
           </soapenv:Body>
        </soapenv:Envelope>`;

        try {
            const response = await axios.post(process.env.SAP_CUSTOMER_URL, xmlPayload, {
                headers: {
                    'Content-Type': 'text/xml;charset=utf-8',
                    'SOAPAction': 'http://sap.com/xi/A1S/Global/QueryCustomerIn/FindByIdentificationRequest',
                },
                auth: {
                    username: process.env.SAP_USERNAME,
                    password: process.env.SAP_PASSWORD,
                },
            });

            const parsed = await parseSapXml(response.data);
            const resp = parsed?.Envelope?.Body?.CustomerByIdentificationResponse_sync;
            const customers = resp?.Customer;
            
            if (customers) {
                const custArr = Array.isArray(customers) ? customers : [customers];
                totalAccounts += custArr.length;
                process.stdout.write(`\rCounting Accounts... ${totalAccounts}`);
            }

            const conditions = resp?.ProcessingConditions;
            const moreHits = conditions?.MoreHitsAvailableIndicator;
            hasMore = (typeof moreHits === 'object' ? moreHits._ : String(moreHits)).toLowerCase() === 'true';

            if (hasMore) {
                const returnedObjId = conditions?.LastReturnedObjectID;
                lastObjectId = typeof returnedObjId === 'object' ? returnedObjId._ : String(returnedObjId);
                if (!lastObjectId || lastObjectId === 'undefined') break;
            }
        } catch (err) {
            logger.error(`\nCount failed: ${err.message}`);
            break;
        }
    }
    
    logger.info(`\n✅ Total SAP Accounts found: ${totalAccounts}`);
    return totalAccounts;
};

const countSapContacts = async () => {
    logger.info("\nStarting lightweight count for SAP Contacts...");
    let totalContacts = 0;
    let lastObjectId = null;
    let hasMore = true;

    while (hasMore) {
        const paginationNode = lastObjectId 
            ? `<LastReturnedObjectID>${lastObjectId}</LastReturnedObjectID>` 
            : '';

        const xmlPayload = `
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
                 <ProcessingConditions>
                    <QueryHitsMaximumNumberValue>100</QueryHitsMaximumNumberValue>
                    <QueryHitsUnlimitedIndicator>false</QueryHitsUnlimitedIndicator>
                    ${paginationNode}
                 </ProcessingConditions>
              </glob:CustomerByElementsQuery_sync>
           </soapenv:Body>
        </soapenv:Envelope>`;

        try {
            const response = await axios.post(process.env.SAP_CUSTOMER_URL, xmlPayload, {
                headers: {
                    'Content-Type': 'text/xml;charset=utf-8',
                    'SOAPAction': 'http://sap.com/xi/A1S/Global/QueryCustomerIn/FindByElementsRequest',
                },
                auth: {
                    username: process.env.SAP_USERNAME,
                    password: process.env.SAP_PASSWORD,
                },
            });

            const parsed = await parseSapXml(response.data);
            const resp = parsed?.Envelope?.Body?.CustomerByElementsResponse_sync;
            const customers = resp?.Customer;
            
            if (customers) {
                const customerArr = Array.isArray(customers) ? customers : [customers];
                let batchContactCount = 0;
                
                for (const cust of customerArr) {
                    if (cust.ContactPerson) {
                        const contacts = Array.isArray(cust.ContactPerson) ? cust.ContactPerson : [cust.ContactPerson];
                        batchContactCount += contacts.length;
                    }
                }
                
                totalContacts += batchContactCount;
                process.stdout.write(`\rCounting Contacts... ${totalContacts}`);
            }

            const conditions = resp?.ProcessingConditions;
            const moreHits = conditions?.MoreHitsAvailableIndicator;
            hasMore = (typeof moreHits === 'object' ? moreHits._ : String(moreHits)).toLowerCase() === 'true';

            if (hasMore) {
                const returnedObjId = conditions?.LastReturnedObjectID;
                lastObjectId = typeof returnedObjId === 'object' ? returnedObjId._ : String(returnedObjId);
                if (!lastObjectId || lastObjectId === 'undefined') break;
            }
        } catch (err) {
            logger.error(`\nCount failed: ${err.message}`);
            break;
        }
    }
    
    logger.info(`\n✅ Total SAP Contacts found: ${totalContacts}`);
    return totalContacts;
};

const run = async () => {
    await countSapAccounts();
    await countSapContacts();
    process.exit(0);
};

run();