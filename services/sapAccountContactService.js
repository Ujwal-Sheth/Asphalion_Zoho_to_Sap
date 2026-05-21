const axios = require('axios');
const { parseSapXml } = require('../utils/xmlParser');

/**
 * Fetches a list of SAP Customers (Accounts) using the Customer Query service.
 * Optionally filters by last modified date for incremental sync.
 * @param {string|null} changedAfter - ISO date string e.g. "2026-01-01T00:00:00Z"
 * @returns {Promise<Array>}
 */
const getSapCustomers = async (changedAfter = null) => {
    const dateFilter = changedAfter
        ? `<SelectionByLastChangedDateTime>
                <IntervalBoundaryTypeCode>3</IntervalBoundaryTypeCode>
                <LowerBoundaryDateTime>${changedAfter}</LowerBoundaryDateTime>
           </SelectionByLastChangedDateTime>`
        : '';

    const xmlPayload = `
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
                ${dateFilter}
             </CustomerSelectionByIdentification>
          </glob:CustomerByIdentificationQuery_sync>
       </soapenv:Body>
    </soapenv:Envelope>`;

    try {
        // If a changedAfter filter is provided we use the date-based selection (single request)
        if (changedAfter) {
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
            if (!customers) return [];
            return Array.isArray(customers) ? customers : [customers];
        }

        // No changedAfter -> perform paginated requests by InternalID to overcome SAP result limits
        const allCustomers = [];
        let lowerBoundary = '*';
        const pageSizeHint = 100; // conservative hint for SAP per-request limit
        const seenIds = new Set();

        while (true) {
            const pagedXml = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
       <soapenv:Header/>
       <soapenv:Body>
          <glob:CustomerByIdentificationQuery_sync>
             <CustomerSelectionByIdentification>
                <SelectionByInternalID>
                   <InclusionExclusionCode>I</InclusionExclusionCode>
                   <IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode>
                   <LowerBoundaryInternalID>${lowerBoundary}</LowerBoundaryInternalID>
                </SelectionByInternalID>
             </CustomerSelectionByIdentification>
          </glob:CustomerByIdentificationQuery_sync>
       </soapenv:Body>
    </soapenv:Envelope>`;

            const response = await axios.post(process.env.SAP_CUSTOMER_URL, pagedXml, {
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

            // Filter out any already-seen InternalIDs (some SAP pages include the boundary ID)
            const newItems = [];
            for (const c of custArr) {
                const id = c?.InternalID?._ || c?.InternalID || null;
                if (!id) {
                    newItems.push(c);
                    continue;
                }
                if (!seenIds.has(String(id))) {
                    seenIds.add(String(id));
                    newItems.push(c);
                }
            }

            if (newItems.length === 0) break; // no progress -> stop

            allCustomers.push(...newItems);

            // If fewer than the hint were returned, assume we've reached the end
            if (custArr.length < pageSizeHint) break;

            // Prepare next lower boundary using the last customer's InternalID
            const last = custArr[custArr.length - 1];
            const lastId = last?.InternalID?._ || last?.InternalID || null;
            if (!lastId) break;
            lowerBoundary = lastId;
        }

        return allCustomers;
    } catch (err) {
        throw new Error(`SAP Customer fetch failed: ${err.response?.data || err.message}`);
    }
};

/**
 * Fetches SAP Contacts via the QueryCustomerIn service (embedded contacts).
 * This is more reliable as the standalone QueryContactPersonIn service often has 500 errors.
 * @param {String|null} changedAfter - ISO date string for incremental sync
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
          </glob:CustomerByElementsQuery_sync>
       </soapenv:Body>
    </soapenv:Envelope>`;

    try {
        // If changedAfter provided, use date-based selection (single request)
        if (changedAfter) {
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
            const customers = parsed?.Envelope?.Body?.CustomerByElementsResponse_sync?.Customer;
            if (!customers) return [];
            const customerArr = Array.isArray(customers) ? customers : [customers];

            const allContacts = [];
            customerArr.forEach(cust => {
                if (cust.ContactPerson) {
                    const contacts = Array.isArray(cust.ContactPerson) ? cust.ContactPerson : [cust.ContactPerson];
                    // Get Parent Tax ID from Customer for linking in Zoho
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
            });

            return allContacts;
        }

        // No changedAfter -> paginate by internal ID to collect all customers (and embedded contacts)
        const allContacts = [];
        let lowerBoundary = '*';
        const pageSizeHint = 100;
        const seenCustomerIds = new Set();

        while (true) {
            const pagedXml = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global">
       <soapenv:Header/>
       <soapenv:Body>
          <glob:CustomerByElementsQuery_sync>
             <CustomerSelectionByElements>
                <SelectionByInternalID>
                   <InclusionExclusionCode>I</InclusionExclusionCode>
                   <IntervalBoundaryTypeCode>1</IntervalBoundaryTypeCode>
                   <LowerBoundaryInternalID>${lowerBoundary}</LowerBoundaryInternalID>
                </SelectionByInternalID>
             </CustomerSelectionByElements>
             <CustomerRequestedElements>
                <ContactPersonTransmissionRequestCode>1</ContactPersonTransmissionRequestCode>
             </CustomerRequestedElements>
          </glob:CustomerByElementsQuery_sync>
       </soapenv:Body>
    </soapenv:Envelope>`;

            const response = await axios.post(process.env.SAP_CUSTOMER_URL, pagedXml, {
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
            const customers = parsed?.Envelope?.Body?.CustomerByElementsResponse_sync?.Customer;
            if (!customers) break;
            const customerArr = Array.isArray(customers) ? customers : [customers];

            // Filter out already-seen customers (some SAP pages include the boundary customer)
            const newCustomers = [];
            for (const cust of customerArr) {
                const cid = cust?.InternalID?._ || cust?.InternalID || null;
                if (!cid) {
                    newCustomers.push(cust);
                    continue;
                }
                if (!seenCustomerIds.has(String(cid))) {
                    seenCustomerIds.add(String(cid));
                    newCustomers.push(cust);
                }
            }

            if (newCustomers.length === 0) break;

            newCustomers.forEach(cust => {
                if (cust.ContactPerson) {
                    const contacts = Array.isArray(cust.ContactPerson) ? cust.ContactPerson : [cust.ContactPerson];
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
            });

            if (customerArr.length < pageSizeHint) break;
            const last = customerArr[customerArr.length - 1];
            const lastId = last?.InternalID?._ || last?.InternalID || null;
            if (!lastId) break;
            lowerBoundary = lastId;
        }

        return allContacts;
    } catch (err) {
        throw new Error(`SAP Contact fetch (via Customer) failed: ${err.message}`);
    }
};

module.exports = { getSapCustomers, getSapContacts };
