const SAP_MAPS = require('../constants/sapMaps');

// ISO-3166-1 alpha-2 country codes mapped to Zoho picklist country names
const COUNTRY_MAP = {
    'AL': 'Albania',
    'AD': 'Andorra',
    'AT': 'Austria',
    'BY': 'Belarus',
    'BE': 'Belgium',
    'BA': 'Bosnia and Herzegovina',
    'BG': 'Bulgaria',
    'HR': 'Croatia',
    'CY': 'Cyprus',
    'CZ': 'Czechia (Czech Republic)',
    'DK': 'Denmark',
    'EE': 'Estonia',
    'FI': 'Finland',
    'FR': 'France',
    'DE': 'Germany',
    'GR': 'Greece',
    'HU': 'Hungary',
    'IS': 'Iceland',
    'IE': 'Ireland',
    'IT': 'Italy',
    'XK': 'Kosovo',
    'LV': 'Latvia',
    'LI': 'Liechtenstein',
    'LT': 'Lithuania',
    'LU': 'Luxembourg',
    'MT': 'Malta',
    'MD': 'Moldova',
    'MC': 'Monaco',
    'ME': 'Montenegro',
    'NL': 'Netherlands',
    'MK': 'North Macedonia',
    'NO': 'Norway',
    'PL': 'Poland',
    'PT': 'Portugal',
    'RO': 'Romania',
    'RU': 'Russia',
    'SM': 'San Marino',
    'RS': 'Serbia',
    'SK': 'Slovakia',
    'SI': 'Slovenia',
    'ES': 'Spain',
    'SE': 'Sweden',
    'CH': 'Switzerland',
    'UA': 'Ukraine',
    'GB': 'United Kingdom',
    'VA': 'Vatican City',
    'CR': 'Costa Rica',
    'US': 'Estados Unidos',
    'JP': 'Japón',
    'AR': 'Argentina',
    'CN': 'China',
    'BR': 'Brasil'
};

/**
 * Utility: safely extracts a string value from an xml2js parsed field.
 * Handles both plain strings and { _: 'value', $: {...} } objects.
 */
const getVal = (field) => {
    if (field == null) return null;
    if (typeof field === 'object') return field._ !== undefined ? String(field._).trim() : null;
    return String(field).trim() || null;
};

// Inverted PaymentTerms map (SAP Code -> Zoho Picklist Value)
const PAYMENT_TERMS_MAP = {};
for (const [zohoVal, sapCode] of Object.entries(SAP_MAPS.PaymentTerms || {})) {
    PAYMENT_TERMS_MAP[sapCode] = zohoVal;
}

/**
 * Maps a raw SAP Customer (Account) object to Zoho Account fields.
 * @param {Object} sapCustomer - Parsed xml2js Customer node
 * @returns {Object} Zoho Account payload
 */
const mapSapCustomerToZohoAccount = (sapCustomer) => {
    // Prefer Organisation name, fallback to Person name
    let accountName = getVal(sapCustomer.Organisation?.FirstLineName)
        || getVal(sapCustomer.Organisation?.FormattedName);

    // 2. Fallback to Person (GivenName + FamilyName)
    if (!accountName) {
        // SAP XML can sometimes put this under <Person> or <CommonPerson><PersonName>
        const givenName = getVal(sapCustomer.Person?.GivenName) 
            || getVal(sapCustomer.CommonPerson?.PersonName?.GivenName) 
            || '';
            
        const familyName = getVal(sapCustomer.Person?.FamilyName) 
            || getVal(sapCustomer.CommonPerson?.PersonName?.FamilyName) 
            || getVal(sapCustomer.CommonPerson?.PersonName?.LastName) 
            || '';

        const personName = `${givenName} ${familyName}`.trim();
        
        if (personName) {
            accountName = personName;
        }
    }

    // 3. Final fallback
    accountName = accountName || 'Unknown Name';
    
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

    // Extract default address block safely
    const addrInfo = sapCustomer.AddressInformation;
    let mainAddress = null;
    if (addrInfo) {
        const arr = Array.isArray(addrInfo) ? addrInfo : [addrInfo];
        // Prefer XXDEFAULT or the first element
        mainAddress = arr.find(a => a.AddressUsage?.AddressUsageCode === 'XXDEFAULT') || arr[0];
    }

    const addr = mainAddress?.Address?.PostalAddress;
    const street  = getVal(addr?.StreetName);
    const city    = getVal(addr?.CityName);
    const state   = getVal(addr?.RegionCode);
    const country = getVal(addr?.CountryCode);
    const zip     = getVal(addr?.StreetPostalCode);

    // Combine address fields into a single Billing_Address block
    const billingAddress = [street, city, state, zip, country].filter(Boolean).join('\n');

    // Email — EmailURI inside primary address block
    const email = getVal(mainAddress?.Address?.EmailURI);

    // Map 2-letter SAP CountryCode to Zoho's picklist country name
    const countryName = country ? (COUNTRY_MAP[country.toUpperCase()] || country) : null;

    // Map SAP CorrespondenceLanguageCode to Zoho's picklist Language (Spanish or English)
    const langCode = getVal(mainAddress?.Address?.CorrespondenceLanguageCode);
    let languageName = null;
    if (langCode) {
        const lower = langCode.toLowerCase();
        if (lower === 'es') languageName = 'Spanish';
        else if (lower === 'en') languageName = 'English';
    }

    // Industry / Sector — CategoryCode in SAP (numeric), map if needed
    const industry = getVal(sapCustomer.IndustrySectorCode)
        || getVal(sapCustomer.SalesArrangement?.SalesTerritoryID)
        || null;

    // SAP internal Customer ID
    const sapCustomerId = getVal(sapCustomer.InternalID);

    // Customer Status from LifeCycleStatusCode
    const lifeCycleStatusCode = getVal(sapCustomer.LifeCycleStatusCode);
    const statusMap = {
        "2": "Active",
        "3": "Block",
        "4": "Inactive"
    };
    const customerStatus = statusMap[lifeCycleStatusCode] || null;

    // Payment Terms (CashDiscountTermsCode) from SalesArrangement
    const salesArr = sapCustomer.SalesArrangement;
    let cashDiscountTermsCode = null;
    if (salesArr) {
        const arr = Array.isArray(salesArr) ? salesArr : [salesArr];
        const found = arr.find(s => s.CashDiscountTermsCode);
        if (found) {
            cashDiscountTermsCode = getVal(found.CashDiscountTermsCode);
        }
    }
    const paymentTerms = cashDiscountTermsCode ? PAYMENT_TERMS_MAP[cashDiscountTermsCode] : null;

    return {
        Account_Name:        accountName,
        Tax_ID:              taxId,
        Billing_Address:     billingAddress,
        Main_email:          email,
        Country:             countryName,
        Language:            languageName,
        Industry:            industry,
        SAP_Customer_ID:     sapCustomerId,
        Payment_Terms:       paymentTerms,
        Customer_status_SAP: customerStatus,
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

    return {
        First_Name:        firstName,
        Last_Name:         lastName || firstName || 'Unknown',
        Email:             email,
        Phone:             phone,
        Title:             jobTitle,
        Department:        department,
        SAP_Contact_ID:    sapContactId,
        // Internal use — not sent to Zoho directly
        _relatedAccountTaxId: relatedAccountTaxId,
    };
};

module.exports = { mapSapCustomerToZohoAccount, mapSapContactToZohoContact };
