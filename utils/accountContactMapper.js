/**
 * Utility: safely extracts a string value from an xml2js parsed field.
 * Handles both plain strings and { _: 'value', $: {...} } objects.
 */
const getVal = (field) => {
    if (field == null) return null;
    if (typeof field === 'object') return field._ !== undefined ? String(field._).trim() : null;
    return String(field).trim() || null;
};

/**
 * Maps a raw SAP Customer (Account) object to Zoho Account fields.
 * @param {Object} sapCustomer - Parsed xml2js Customer node
 * @returns {Object} Zoho Account payload
 */
const mapSapCustomerToZohoAccount = (sapCustomer) => {
    // Prefer Organisation name, fallback to Person name
    const orgName = getVal(sapCustomer.Organisation?.FirstLineName)
        || getVal(sapCustomer.Organisation?.FormattedName)
        || getVal(sapCustomer.CommonPerson?.PersonName?.LastName)
        || 'Unknown';

    // Tax / CIF / NIF — SAP stores it in TaxNumber.PartyTaxID
    const taxEntry = sapCustomer.TaxNumber;
    let taxId = null;
    if (taxEntry) {
        const taxArr   = Array.isArray(taxEntry) ? taxEntry : [taxEntry];
        // Prefer VAT TypeCode '5' or take the first available
        const vatEntry = taxArr.find(t => {
            const code = t.TaxIdentificationNumberTypeCode;
            return (typeof code === 'object' ? code._ : String(code || '')) === '5';
        }) || taxArr[0];
        const partyTaxId = vatEntry?.PartyTaxID;
        taxId = partyTaxId
            ? (typeof partyTaxId === 'object' ? partyTaxId._ : String(partyTaxId)).trim()
            : null;
    }
    // Fallback: DunAndBradstreet number as a unique identifier
    if (!taxId) taxId = getVal(sapCustomer.DunAndBradstreetNumberID) || null;

    // Address — inside AddressInformation.Address.PostalAddress
    const addr = sapCustomer.AddressInformation?.Address?.PostalAddress;
    const street  = getVal(addr?.StreetName);
    const city    = getVal(addr?.CityName);
    const state   = getVal(addr?.RegionCode);
    const country = getVal(addr?.CountryCode);
    const zip     = getVal(addr?.StreetPostalCode);

    // Industry / Sector — CategoryCode in SAP (numeric), map if needed
    const industry = getVal(sapCustomer.IndustrySectorCode)
        || getVal(sapCustomer.SalesArrangement?.SalesTerritoryID)
        || null;

    // SAP internal Customer ID
    const sapCustomerId = getVal(sapCustomer.InternalID);

    // Last modified date from SystemAdministrativeData
    const lastModified = getVal(sapCustomer.SystemAdministrativeData?.LastChangeDateTime)
        || getVal(sapCustomer.SystemAdministrativeData?.CreationDateTime);

    return {
        Account_Name:      orgName,
        Tax_ID:            taxId,
        Billing_Street:    street,
        Billing_City:      city,
        Billing_State:     state,
        Billing_Country:   country,
        Billing_Code:      zip,
        Industry:          industry,
        SAP_Customer_ID:   sapCustomerId,
        SAP_Last_Modified: lastModified,
    };
};

/**
 * Maps a raw SAP Contact object (embedded in Customer response) to Zoho Contact fields.
 * @param {Object} sapContact - Parsed xml2js ContactPerson node
 * @returns {Object} Zoho Contact payload (without Account link)
 */
const mapSapContactToZohoContact = (sapContact) => {
    const firstName = getVal(sapContact.GivenName) || '';
    const lastName  = getVal(sapContact.FamilyName) || '';

    // Email — WorkplaceEmailURI in embedded structure
    const email = getVal(sapContact.WorkplaceEmailURI);

    // Phone — WorkplaceTelephone
    const phone = getVal(sapContact.WorkplaceTelephone?.FormattedNumberDescription)
        || getVal(sapContact.WorkplaceTelephone?.SubscriberID);

    // Job Title / Department
    const jobTitle   = getVal(sapContact.WorkplaceFunctionalTitleName);
    const department = getVal(sapContact.WorkplaceFunctionalDepartmentName);

    // SAP Contact internal ID
    const sapContactId = getVal(sapContact.BusinessPartnerContactInternalID);

    // Related Account Tax ID — passed through by the service
    const relatedAccountTaxId = sapContact._parentTaxId;

    // Last modified date is not directly on the embedded contact, 
    // but the parent customer date is used if needed.
    const lastModified = getVal(sapContact.LastChangedDateTime); 

    return {
        First_Name:        firstName,
        Last_Name:         lastName || firstName || 'Unknown',
        Email:             email,
        Phone:             phone,
        Title:             jobTitle,
        Department:        department,
        SAP_Contact_ID:    sapContactId,
        SAP_Last_Modified: lastModified,
        // Internal use — not sent to Zoho directly
        _relatedAccountTaxId: relatedAccountTaxId,
    };
};

module.exports = { mapSapCustomerToZohoAccount, mapSapContactToZohoContact };
