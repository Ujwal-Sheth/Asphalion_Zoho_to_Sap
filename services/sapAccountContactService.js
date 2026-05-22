const axios = require('axios');
const { parseSapXml } = require('../utils/xmlParser');

/**
 * Fetches a list of SAP Customers (Accounts) using the Customer Query service.
 * Utilizes SAP Cursor (LastReturnedObjectID) for reliable pagination.
 */
const getSapCustomers = async (changedAfter = null) => {
    const dateFilter = changedAfter
        ? `<SelectionByLastChangedDateTime>
                <IntervalBoundaryTypeCode>3</IntervalBoundaryTypeCode>
                <LowerBoundaryDateTime>${changedAfter}</LowerBoundaryDateTime>
           </SelectionByLastChangedDateTime>`
        : '';

    const allCustomers = [];
    const pageSize = 100; // Safe batch size for full XML payloads
    const seenIds = new Set();
    
    // SAP Cursor for pagination
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
                    <SelectionByRoleCode>
                       <InclusionExclusionCode>I</InclusionExclusionCode>
                       <IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode>
                       <LowerBoundaryRoleCode>CRM000</LowerBoundaryRoleCode>
                    </SelectionByRoleCode>
                    ${dateFilter}
                 </CustomerSelectionByIdentification>
                 <ProcessingConditions>
                    <QueryHitsMaximumNumberValue>${pageSize}</QueryHitsMaximumNumberValue>
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
            
            if (!customers) break;

            const custArr = Array.isArray(customers) ? customers : [customers];
            
            for (const c of custArr) {
                const id = c?.InternalID?._ || c?.InternalID || null;
                if (id && !seenIds.has(String(id))) {
                    seenIds.add(String(id));
                    allCustomers.push(c);
                }
            }

            // Extract cursor for the next page
            const conditions = resp?.ProcessingConditions;
            const moreHits = conditions?.MoreHitsAvailableIndicator;
            hasMore = (typeof moreHits === 'object' ? moreHits._ : String(moreHits)).toLowerCase() === 'true';

            if (hasMore) {
                const returnedObjId = conditions?.LastReturnedObjectID;
                lastObjectId = typeof returnedObjId === 'object' ? returnedObjId._ : String(returnedObjId);
                if (!lastObjectId || lastObjectId === 'undefined') break;
            }

        } catch (err) {
            throw new Error(`SAP Customer fetch failed: ${err.response?.data || err.message}`);
        }
    }

    return allCustomers;
};

/**
 * Fetches SAP Contacts via the QueryCustomerIn service (embedded contacts).
 * Utilizes SAP Cursor (LastReturnedObjectID) for reliable pagination.
 */
const getSapContacts = async (changedAfter = null) => {
    const dateFilter = changedAfter
        ? `<SelectionByLastChangedDateTime>
                <InclusionExclusionCode>I</InclusionExclusionCode>
                <IntervalBoundaryTypeCode>3</IntervalBoundaryTypeCode>
                <LowerBoundaryLastChangedDateTime>${changedAfter}</LowerBoundaryLastChangedDateTime>
           </SelectionByLastChangedDateTime>`
        : `<SelectionByInternalID>
                <InclusionExclusionCode>I</InclusionExclusionCode>
                <IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode>
                <LowerBoundaryInternalID>*</LowerBoundaryInternalID>
           </SelectionByInternalID>`;

    const allContacts = [];
    const pageSize = 50; // Conservative size to handle massive embedded contact payloads
    const seenCustomerIds = new Set();
    
    // SAP Cursor for pagination
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
                    ${dateFilter}
                 </CustomerSelectionByElements>
                 <CustomerRequestedElements>
                    <ContactPersonTransmissionRequestCode>1</ContactPersonTransmissionRequestCode>
                 </CustomerRequestedElements>
                 <ProcessingConditions>
                    <QueryHitsMaximumNumberValue>${pageSize}</QueryHitsMaximumNumberValue>
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
            
            if (!customers) break;
            
            const customerArr = Array.isArray(customers) ? customers : [customers];
            
            for (const cust of customerArr) {
                const cid = cust?.InternalID?._ || cust?.InternalID || null;
                if (cid && !seenCustomerIds.has(String(cid))) {
                    seenCustomerIds.add(String(cid));
                    
                    if (cust.ContactPerson) {
                        const contacts = Array.isArray(cust.ContactPerson) ? cust.ContactPerson : [cust.ContactPerson];
                        
                        // Extract parent Tax ID for Zoho linking
                        const taxEntry = cust.TaxNumber;
                        let parentTaxId = null;
                        if (taxEntry) {
                            const taxArr = Array.isArray(taxEntry) ? taxEntry : [taxEntry];
                            const vatEntry = taxArr.find(t => {
                                const code = t.TaxIdentificationNumberTypeCode;
                                return (typeof code === 'object' ? code._ : String(code || '')) === '5';
                            }) || taxArr[0];
                            const partyTaxId = vatEntry?.PartyTaxID;
                            parentTaxId = partyTaxId ? (typeof partyTaxId === 'object' ? partyTaxId._ : String(partyTaxId)).trim() : null;
                        }
                        if (!parentTaxId) parentTaxId = (typeof cust.DunAndBradstreetNumberID === 'object' ? cust.DunAndBradstreetNumberID?._ : cust.DunAndBradstreetNumberID) || null;

                        contacts.forEach(contact => {
                            contact._parentTaxId = parentTaxId;
                            allContacts.push(contact);
                        });
                    }
                }
            }

            // Extract cursor for the next page
            const conditions = resp?.ProcessingConditions;
            const moreHits = conditions?.MoreHitsAvailableIndicator;
            hasMore = (typeof moreHits === 'object' ? moreHits._ : String(moreHits)).toLowerCase() === 'true';

            if (hasMore) {
                const returnedObjId = conditions?.LastReturnedObjectID;
                lastObjectId = typeof returnedObjId === 'object' ? returnedObjId._ : String(returnedObjId);
                if (!lastObjectId || lastObjectId === 'undefined') break;
            }

        } catch (err) {
            throw new Error(`SAP Contact fetch (via Customer) failed: ${err.message}`);
        }
    }

    return allContacts;
};

module.exports = { getSapCustomers, getSapContacts };