const SAP_MAPS = require('../constants/sapMaps');
const { formatDateOnly } = require('./dateUtils');

// Helper to invert the map (SAP Code -> Zoho Text)
const invertMap = (map) => {
    const inverted = {};
    for (const [zohoText, sapCode] of Object.entries(map)) {
        inverted[sapCode] = zohoText;
    }
    return inverted;
};

// Create the inverted maps once
const ZOHO_MAPS = {
    ProjectType: invertMap(SAP_MAPS.ProjectType),
    Source: invertMap(SAP_MAPS.Source),
    Category: invertMap(SAP_MAPS.Category),
    TherapeuticalArea: invertMap(SAP_MAPS.TherapeuticalArea),
    LegalBasis: invertMap(SAP_MAPS.LegalBasis),
    Procedure: invertMap(SAP_MAPS.Procedure),
    HuntingFarming: invertMap(SAP_MAPS.HuntingFarming),
    PaymentTerms: invertMap(SAP_MAPS.PaymentTerms),
    Probability: invertMap(SAP_MAPS.Probability),
    TypeOfProduct: invertMap(SAP_MAPS.TypeOfProduct)
};

/**
 * Maps raw SAP Quote data to Zoho Deal fields.
 * @param {Object} sapQuote 
 * @returns {Object} Mapped fields for Zoho.
 */
const mapSapDataToZoho = (sapQuote) => {
    // Helper to safely extract values from the xml2js output.
    // Handles if it's an object { _: 'value' } or a direct string.
    const getVal = (field) => (field && field._ !== undefined) ? field._ : field;
    
    return {
        Creation_Date: formatDateOnly(sapQuote.PostingDate),
        Closing_Date: formatDateOnly(getVal(sapQuote.RequestedFulfillmentPeriodPeriodTerms?.EndDateTime)),
        
        // --- DROPDOWN FIELDS (Reverse Mapped) ---
        Project_Type: ZOHO_MAPS.ProjectType[getVal(sapQuote.TipodeProyecto)],
        Source: ZOHO_MAPS.Source[getVal(sapQuote.Origen)],
        Category: ZOHO_MAPS.Category[getVal(sapQuote.Categoria)],
        Therapeutical_area: ZOHO_MAPS.TherapeuticalArea[getVal(sapQuote.reateraputica)],
        Legal_Basis: ZOHO_MAPS.LegalBasis[getVal(sapQuote.Baselegal)],
        Procedure: ZOHO_MAPS.Procedure[getVal(sapQuote.Procedimiento1)],
        Hunting_Farming: ZOHO_MAPS.HuntingFarming[getVal(sapQuote.HuntingFarming)],
        Payment_Terms: ZOHO_MAPS.PaymentTerms[sapQuote.CashDiscountTerms?.Code], 
        Probability1: ZOHO_MAPS.Probability[getVal(sapQuote.ProbabilidadOfertaAsphalion)],
        Type_of_Product: ZOHO_MAPS.TypeOfProduct[getVal(sapQuote.Tipodeproducto)],

        // --- DIRECT TEXT/NUMBER FIELDS ---
        Description: getVal(sapQuote.Name),
        Amount: getVal(sapQuote.EstimacionIngresos),
        
        // --- LONG TEXT AREAS ---
        Background_intro_ES: getVal(sapQuote.BackgroundBymeans),
        Agreed_fees_sales_quote_EN: getVal(sapQuote.AgreedfeessalesquoteEN),
        End_notes_sales_quote_ES: getVal(sapQuote.Footnotes1),
        End_notes_sales_quote_EN: getVal(sapQuote.EndnotessalesquoteEN),
        Background_intro_EN: getVal(sapQuote.BackgroundintroEN),
        Background: getVal(sapQuote.Background1),
        Invoicing_type_EN: getVal(sapQuote.InvoicingtypeEN),
        Invoicing_type_ES: getVal(sapQuote.InvoicingtypeES),
        Procedure_country: getVal(sapQuote.Pasdelprocedimiento),
        Active_substance: getVal(sapQuote.Sustanciaactiva1),
        Indication: getVal(sapQuote.Indicacin),
        Mail_invoice_repository: getVal(sapQuote.Repositoriocorreosdefacturacin),
        Invoicing_emails: getVal(sapQuote.Correosdefacturacin),

        // --- BOOLEANS ---
        STAND_BY: getVal(sapQuote.STANDBY) === "true",

        // Note: Contact_Name mapping is excluded here assuming Zoho uses a Lookup field
        // which requires a specific Record ID rather than a plain string name.
    };
};

module.exports = { mapSapDataToZoho };
