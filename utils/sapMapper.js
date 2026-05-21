const SAP_MAPS = require('../constants/sapMaps');
const { formatDateOnly, formatSapDatePeriod } = require('./dateUtils');

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
    const getVal = (field) => {
        if (field == null) return null;
        if (typeof field === 'object') return field._ !== undefined ? field._ : null;
        return field;
    };

    let totalAmount = 0;
    let hasAmount = false;
    if (sapQuote.Item) {
        const items = Array.isArray(sapQuote.Item) ? sapQuote.Item : [sapQuote.Item];
        items.forEach(item => {
            const val = getVal(item.EstimacionIngresos);
            if (val != null && val !== '') {
                totalAmount += parseFloat(val) || 0;
                hasAmount = true;
            }
        });
    }

    const result = {
        Creation_Date: formatDateOnly(getVal(sapQuote.PostingDate)),
        // Closing_Date: formatSapDatePeriod(sapQuote.ValidityPeriodPeriodTerms),

        // --- DROPDOWN FIELDS (Reverse Mapped) ---
        Project_Type: ZOHO_MAPS.ProjectType[getVal(sapQuote.TipodeProyecto)],
        Source: ZOHO_MAPS.Source[getVal(sapQuote.Origen)],
        Main_Technical_Unit: ZOHO_MAPS.Category[getVal(sapQuote.Categoria)],
        Therapeutical_area: ZOHO_MAPS.TherapeuticalArea[getVal(sapQuote.reateraputica)],
        Legal_Basis: ZOHO_MAPS.LegalBasis[getVal(sapQuote.Baselegal)],
        Procedure: ZOHO_MAPS.Procedure[getVal(sapQuote.Procedimiento1)],
        Hunting_Farming: ZOHO_MAPS.HuntingFarming[getVal(sapQuote.HuntingFarming)],
        Payment_Terms: ZOHO_MAPS.PaymentTerms[sapQuote.CashDiscountTerms?.Code],
        Probability1: ZOHO_MAPS.Probability[getVal(sapQuote.ProbabilidadOfertaAsphalion)],
        Type_of_Product: ZOHO_MAPS.TypeOfProduct[getVal(sapQuote.Tipodeproducto)],

        // --- DIRECT TEXT/NUMBER FIELDS ---
        Description: getVal(sapQuote.Name),
        Amount: hasAmount ? Number(totalAmount.toFixed(2)) : null,

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

        // --- NEW FIELDS FROM SAP EXTENSIONS ---
        Acceptance_Date: formatDateOnly(getVal(sapQuote.Fechadeaceptacin)),
    };

    // Add Approval Status mapping using standard SAP codes
    const approvalCode = getVal(sapQuote.Status?.ApprovalStatusCode);
    const approvalMap = {
        "1": "No relevante",
        "2": "Pendiente",
        "3": "Ganada",
        "4": "Pérdida"
    };

    result.Approval_Status = approvalMap[approvalCode] || getVal(sapQuote.estadopendiente);

    return result;
};

const mapSapItemToZohoSubformItem = (sapItem) => {
    const getVal = (field) => {
        if (field == null) return null;
        if (typeof field === 'object') return field._ !== undefined ? field._ : null;
        return field;
    };

    // Extract Discount from ItemPriceComponent array
    let discountVal = 0;
    if (sapItem.PriceAndTaxCalculationItem && sapItem.PriceAndTaxCalculationItem.ItemPriceComponent) {
        const components = Array.isArray(sapItem.PriceAndTaxCalculationItem.ItemPriceComponent)
            ? sapItem.PriceAndTaxCalculationItem.ItemPriceComponent
            : [sapItem.PriceAndTaxCalculationItem.ItemPriceComponent];

        // Prefer "Total Given Discounts (%)" if available, else fallback to any discount
        let discountComp = components.find(c => getVal(c.Description) === "Total Given Discounts (%)");
        if (!discountComp) {
            discountComp = components.find(c => {
                const desc = getVal(c.Description);
                return desc && desc.toLowerCase().includes('discount');
            });
        }

        if (discountComp && discountComp.Rate && discountComp.Rate.DecimalValue) {
            discountVal = Math.round(Math.abs(parseFloat(discountComp.Rate.DecimalValue)));
        }
    }

    const qty = sapItem.ItemScheduleLine?.Quantity;
    const price = sapItem.PriceAndTaxCalculationItem?.ItemMainPrice?.Rate;

    return {
        Product_Code: getVal(sapItem.ItemProduct?.ProductInternalID) || getVal(sapItem.ProductID),
        Activity_description: getVal(sapItem.Description),
        Quantity: qty ? parseFloat(getVal(qty)) : 0,
        Unit: qty && qty.$ ? qty.$.unitCode : '',
        Unit_Price: price ? parseFloat(price.DecimalValue) : 0,
        Discount: discountVal,
        Optional: getVal(sapItem.OptionalIndicator) === 'true' || sapItem.OptionalIndicator === true,
        Footnotes_Ingles1: getVal(sapItem.NotasalpieEN),
    };
};

module.exports = { mapSapDataToZoho, mapSapItemToZohoSubformItem };
