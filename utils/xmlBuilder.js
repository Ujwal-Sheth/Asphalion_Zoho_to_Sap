const SAP_MAPS = require('../constants/sapMaps');

// Helper function to safely get a mapped code, returning a fallback if not found
const getCode = (mapName, zohoValue, fallback = "") => {
  if (!zohoValue) return fallback;
  return SAP_MAPS[mapName][zohoValue] || fallback;
};

const getSalesUnit = (categoryText) => {
  const salesUnitMapping = {
    "eSUB_RegOps": "1170", // AS_eSub RegOps
    "DATA_Regops": "1190", // AS_DATA RegOps
    CMC: "1101", // AS_CMC
    DW: "1150", // AS_DW
    MedTech: "1130", // AS_MD
    Medtech: "1130", // AS_MD
    LCM: "1102", // AS_LCM
    PV: "1160", // AS_PV
    "Business Development": "1310", // AS_BD
    Others: "1180", // AS_OTHERS
  };

  // Return the mapped code, or default to "1180" (AS_OTHERS) if no match is found
  return salesUnitMapping[categoryText] || "1180";
};

const formatDateOnly = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date.toISOString().split('.')[0] + 'Z';
};

const buildSapXmlPayload = (zohoData, accountId, sapQuoteId = null, accountLanguage = 'English') => {
  console.log(`[XML] Building payload for Deal ID: ${zohoData.id}, Quote ID: ${sapQuoteId}`);

  const lang = accountLanguage ? accountLanguage.toLowerCase() : 'english';
  const isEnglish = lang.includes('en') || lang === 'english';
  const isSpanish = lang.includes('es') || lang === 'spanish' || lang === 'español';
  // --- UPDATE FLOW ---
  if (sapQuoteId) {
    const subformItems = zohoData.Product_Details || [];
    const sapZohoOwnerName = zohoData.Owner?.name || "";

    const zohoStage = zohoData.Stage || "";
    const isLossStage = zohoStage.toLowerCase().includes("draft"); // Adjust if your exact stage name differs
    const sapLossDate = isLossStage ? formatDateOnly(zohoData.Closing_Date) : "";

    const sapZohoCode = zohoData.Deal_Code || "";
    const sapZohoDealID = zohoData.id || "";
    const sapContactName = zohoData.Contact_Name?.name || "";
    const sapDescription = zohoData.Deal_Name;
    const sapPaymentTerms = getCode("PaymentTerms", zohoData.Payment_Terms);
    const sapEstimatedTimeline = zohoData.Estimated_Project_Timeline_in_months || "";
    const sapAcceptanceDate = formatDateOnly(zohoData.Acceptance_Date) || "";
    const sapValidityStart = formatDateTime(zohoData.Creation_Date) || "";
    const sapValidityEnd = formatDateTime(zohoData.Closing_Date) || "";
    const sapSendingDate = formatDateOnly(zohoData.Sent_to_the_client_date) || "";
    const sapProductType = getCode("ProjectType", zohoData.Project_Type);
    const sapSource = getCode("Source", zohoData.Source || zohoData.Lead_Source);
    const sapTechnicalUnit = getCode("TechnicalUnit", zohoData.Main_Technical_Unit);
    const sapTherapeuticalArea = getCode("TherapeuticalArea", zohoData.Therapeutical_area);
    const sapLegalBasis = getCode("LegalBasis", zohoData.Legal_Basis);
    const sapProcedure = getCode("Procedure", zohoData.Procedure);
    const sapHuntingFarming = getCode("HuntingFarming", zohoData.Hunting_Farming);
    const sapSalesUnit = getSalesUnit(zohoData.Main_Technical_Unit);
    const sapProbability = getCode("Probability", zohoData.Approval);
    const sapTypeOfProduct = getCode("TypeOfProduct", zohoData.Type_of_Product);
    const sapStandBy = (zohoData.STAND_BY === true || zohoData.STAND_BY === "true") ? "true" : "false";
    const sapPricingType = getCode("PricingType", zohoData.Price_Type);
    // Long text fields
    const sapBackgroundIntroES = zohoData.Background_intro_ES || "";
    const sapAgreedFeesEN = zohoData.Agreed_fees_sales_quote_EN || "";
    const sapEndNotesES = zohoData.End_notes_sales_quote_ES || "";
    const sapEndNotesEN = zohoData.End_notes_sales_quote_EN || "";
    const sapBackgroundIntroEN = zohoData.Background_intro_EN || "";
    const sapBackground = zohoData.Background || "";
    const sapInvoicingTypeEN = zohoData.Invoicing_type_EN || "";
    const sapInvoicingTypeES = zohoData.Invoicing_type_ES || "";
    const sapProcedureCountry = zohoData.Procedure_country || "";
    const sapActiveSubstance = zohoData.Active_substance || "";
    const sapIndication = zohoData.Indication || "";
    const sapMailInvoiceRepository = zohoData.Mail_invoice_repository || "";
    const sapInvoiceEmails = zohoData.Invoicing_emails || "";
    return `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global" xmlns:a3z="http://sap.com/xi/AP/CustomerExtension/BYD/A3Z5O">
   <soap:Header/>
   <soap:Body>
      <glob:CustomerQuoteBundleMaintainRequest_sync>
         <CustomerQuote actionCode="02">
            <ID>${sapQuoteId}</ID>
            <PostingDate>${sapValidityStart}</PostingDate>
            <Name languageCode="EN">${sapDescription}</Name>
            <CashDiscountTermsCode>${sapPaymentTerms}</CashDiscountTermsCode>

            <SalesUnitParty actionCode="02">
               <PartyID>${sapSalesUnit}</PartyID>
            </SalesUnitParty>
            <SubmitIndicator>true</SubmitIndicator>
            <a3z:DEALreferenceZOHO>${sapZohoOwnerName}</a3z:DEALreferenceZOHO>
            <a3z:ZohoDealID>${sapZohoCode}</a3z:ZohoDealID>
            ${sapSendingDate ? `<a3z:Fechadeenvo>${sapSendingDate}</a3z:Fechadeenvo>` : ""}
            ${sapAcceptanceDate ? `<a3z:Fechadeaceptacin>${sapAcceptanceDate}</a3z:Fechadeaceptacin>` : ""}
            ${sapLossDate ? `<a3z:Fechadeperdida>${sapLossDate}</a3z:Fechadeperdida>` : ""}
            <a3z:Personadecontacto>${sapContactName}</a3z:Personadecontacto>
            ${sapEstimatedTimeline ? `<a3z:DuracionProyectoEstimada>${sapEstimatedTimeline}</a3z:DuracionProyectoEstimada>` : ""}
            <a3z:Discount>${subformItems.some(item => (item.Discount && parseFloat(item.Discount) > 0)) ? "true" : "false"}</a3z:Discount>
           
            ${sapProductType ? `<a3z:TipodeProyecto>${sapProductType}</a3z:TipodeProyecto>` : ""}
            ${sapSource ? `<a3z:Origen>${sapSource}</a3z:Origen>` : ""}
            ${sapTechnicalUnit ? `<a3z:Categoria>${sapTechnicalUnit}</a3z:Categoria>` : ""}
            ${sapTherapeuticalArea ? `<a3z:reateraputica>${sapTherapeuticalArea}</a3z:reateraputica>` : ""}
            ${sapLegalBasis ? `<a3z:Baselegal>${sapLegalBasis}</a3z:Baselegal>` : ""}
            ${sapProcedure ? `<a3z:Procedimiento1>${sapProcedure}</a3z:Procedimiento1>` : ""}
            ${sapHuntingFarming ? `<a3z:HuntingFarming>${sapHuntingFarming}</a3z:HuntingFarming>` : ""}
            ${sapTypeOfProduct ? `<a3z:Tipodeproducto>${sapTypeOfProduct}</a3z:Tipodeproducto>` : ""}
            <a3z:STANDBY>${sapStandBy}</a3z:STANDBY>
            
            ${(sapValidityStart || sapValidityEnd) ? `
            <ValidityPeriodPeriodTerms actionCode="02">
               ${sapValidityStart ? `<StartDateTime>${sapValidityStart}</StartDateTime>` : ""}
               ${sapValidityEnd ? `<EndDateTime>${sapValidityEnd}</EndDateTime>` : ""}
            </ValidityPeriodPeriodTerms>` : ""}
            ${sapProbability ? `<a3z:ProbabilidadOfertaAsphalion>${sapProbability}</a3z:ProbabilidadOfertaAsphalion>` : ""}
            <a3z:Pasdelprocedimiento><![CDATA[${sapProcedureCountry}]]></a3z:Pasdelprocedimiento>
            <a3z:Sustanciaactiva1><![CDATA[${sapActiveSubstance}]]></a3z:Sustanciaactiva1>
            <a3z:Repositoriocorreosdefacturacin><![CDATA[${sapMailInvoiceRepository}]]></a3z:Repositoriocorreosdefacturacin>
            <a3z:Correosdefacturacin><![CDATA[${sapInvoiceEmails}]]></a3z:Correosdefacturacin>
            ${sapIndication ? `<a3z:Indicacin><![CDATA[${sapIndication}]]></a3z:Indicacin>` : ""}
            <a3z:BackgroundBymeans><![CDATA[${sapBackgroundIntroES}]]></a3z:BackgroundBymeans>
            <a3z:AgreedfeessalesquoteEN><![CDATA[${sapAgreedFeesEN}]]></a3z:AgreedfeessalesquoteEN>
            <a3z:Footnotes1><![CDATA[${sapEndNotesES}]]></a3z:Footnotes1>
            <a3z:EndnotessalesquoteEN><![CDATA[${sapEndNotesEN}]]></a3z:EndnotessalesquoteEN>
            <a3z:BackgroundintroEN><![CDATA[${sapBackgroundIntroEN}]]></a3z:BackgroundintroEN>
            <a3z:Background1><![CDATA[${sapBackground}]]></a3z:Background1>
            <a3z:InvoicingtypeEN><![CDATA[${sapInvoicingTypeEN}]]></a3z:InvoicingtypeEN>
            <a3z:InvoicingtypeES><![CDATA[${sapInvoicingTypeES}]]></a3z:InvoicingtypeES>

            ${(() => {
              // Build Items block for update payload
              let itemsXml = "";
              const sapTotalAmount = parseFloat(zohoData.Estimated_Revenue || 0).toFixed(1);
              if (subformItems && subformItems.length > 0) {
                subformItems.forEach((item, index) => {
                  const possibleSno = item['S.NO'] || item.S_NO || item.SNo || item.S_No || item.Sno || item.SN || item.SN_No;
                  let sapItemId = (index + 1) * 10;
                  if (possibleSno) {
                    const parsed = parseInt(String(possibleSno).replace(/\D+/g, ''), 10);
                    if (!isNaN(parsed) && parsed > 0) sapItemId = parsed;
                  }
                  let productCode = "";
                  if (item.Product_Code) {
                    productCode = typeof item.Product_Code === 'object' ? item.Product_Code.name : item.Product_Code;
                  }
                  const quantity = item.Quantity || 1;
                  const unitPrice = parseFloat(item.Unit_Price || 0).toFixed(2);
                  const itemDiscount = parseFloat(item.Discount || 0).toFixed(2);
                  const sapUoM = item.Unidad_de_medida || "";
                  // const sapProcessingTypeCode = getCode("PricingType", item.Pricing_Type);
                  const sapAccordingToFee = (item.According_to_Fee === true || item.According_to_Fee === "true") ? "true" : "false";
                  const sapOptional = (item.Optional === true || item.Optional === "true") ? "true" : "false";
                  const sapFootnotesEnglish = item.Footnotes_Ingles1 || item.Footnotes_Ingles || "";
                  const sapFootnotesSpanish = item.Footnotes_Espa_ol || "";
                  const sapActivityDescription = item.Activity_description || "";
                  // const sapSalesForecast = parseFloat(item.Sales_Forecast || 0).toFixed(2); 
                  let finalFootnote = " ";
                  if (isEnglish) {
                    finalFootnote = sapFootnotesEnglish;
                  } else if (isSpanish) {
                    finalFootnote = sapFootnotesSpanish;
                  } else {
                    finalFootnote = sapFootnotesEnglish || sapFootnotesSpanish || " ";
                  }
                  if (productCode) {
                    // Action '04' (Save) acts as an Upsert: Updates if exists, creates if new
                    const itemAction = '04'; 
                    const parts = [];
                    
                    // FIX 1: Removed itemScheduleLineListCompleteTransmissionIndicator="true"
                    parts.push(`<Items actionCode="${itemAction}">`);
                    parts.push(`<ID>${sapItemId}</ID>`);
                    parts.push(`<OptionalIndicator>${sapOptional}</OptionalIndicator>`);
                    parts.push(`<Description>${sapActivityDescription}</Description>`);
                    if (sapPricingType) parts.push(`<ProcessingTypeCode>${sapPricingType}</ProcessingTypeCode>`);
                    parts.push(`<ItemProduct actionCode="${itemAction}">`);
                    parts.push(`<ProductInternalID>${productCode}</ProductInternalID>`);
                    parts.push(`<UnitOfMeasure>${sapUoM}</UnitOfMeasure>`);
                    parts.push('</ItemProduct>');
                    
                    parts.push(`<ItemScheduleLine actionCode="${itemAction}">`);
                    // FIX 2: Explicitly pass ID 1 to target the existing schedule line for the quantity update
                    parts.push(`<ID>1</ID>`);
                    parts.push(`<Quantity unitCode="${sapUoM}">${quantity}</Quantity>`);
                    parts.push('</ItemScheduleLine>');
                    
                    parts.push(`<ProductRecipientItemParty actionCode="${itemAction}">`);
                    parts.push(`<PartyID>${accountId}</PartyID>`);
                    parts.push('</ProductRecipientItemParty>');
                    
                    // FIX 3: Removed itemPriceComponentListCompleteTransmissionIndicator and itemProductTaxDetailsListCompleteTransmissionIndicator
                    parts.push(`<PriceAndTaxCalculationItem actionCode="${itemAction}">`);
                    
                    parts.push(`<ItemMainDiscount actionCode="${itemAction}">`);
                    parts.push('<Rate>');
                    parts.push(`<DecimalValue>${itemDiscount}</DecimalValue>`);
                    parts.push('</Rate>');
                    parts.push(`</ItemMainDiscount>`);
                    
                    parts.push(`<ItemMainPrice actionCode="${itemAction}">`);
                    parts.push('<Rate>');
                    parts.push(`<DecimalValue>${unitPrice}</DecimalValue>`);
                    parts.push('<CurrencyCode>EUR</CurrencyCode>');
                    parts.push('<BaseDecimalValue>1.0</BaseDecimalValue>');
                    parts.push(`<BaseMeasureUnitCode>${sapUoM}</BaseMeasureUnitCode>`);
                    parts.push('</Rate>');
                    parts.push('</ItemMainPrice>');

                    // parts.push(`<ItemProductTaxDetails actionCode="${itemAction}">`);
                    // parts.push(`<TransactionCurrencyProductTax actionCode="${itemAction}">`);
                    // parts.push(`<BaseAmount currencyCode="EUR">${sapSalesForecast}</BaseAmount>`);
                    // parts.push('</TransactionCurrencyProductTax>');
                    // parts.push('</ItemProductTaxDetails>');
                    
                    parts.push('</PriceAndTaxCalculationItem>');
                    parts.push(`<ItemTextCollection actionCode="${itemAction}">`);
                    parts.push(`<Text>`);
                    parts.push(`<TypeCode>10024</TypeCode>`);
                    parts.push(`<ContentText>${finalFootnote}</ContentText>`);
                    parts.push(`</Text>`);
                    parts.push(`</ItemTextCollection>`);
                    parts.push(`<a3z:EstimacionIngresos currencyCode="EUR">${sapTotalAmount}</a3z:EstimacionIngresos>`);
                    parts.push(`<a3z:Segntarifa>${sapAccordingToFee}</a3z:Segntarifa>`);
                    if (sapFootnotesEnglish) parts.push(`<a3z:NotasalpieEN><![CDATA[${sapFootnotesEnglish}]]></a3z:NotasalpieEN>`);
                    parts.push('<a3z:Ingresos0>false</a3z:Ingresos0>');

                    parts.push('</Items>');
                    itemsXml += '\n' + parts.join('\n');
                  }
                });
              }
              return itemsXml;
            })()}
         </CustomerQuote>
      </glob:CustomerQuoteBundleMaintainRequest_sync>
   </soap:Body>
</soap:Envelope>`.trim();
//  ${sapAcceptanceDate ? `<a3z:Fechadeaceptacin>${sapAcceptanceDate}</a3z:Fechadeaceptacin>` : ""} line 100
  }
    
  const subformItems = zohoData.Product_Details || [];
  const sapZohoOwnerName = zohoData.Owner?.name || "";

  const zohoStage = zohoData.Stage || "";
  const isLossStage = zohoStage.toLowerCase().includes("draft");
  const sapLossDate = isLossStage ? formatDateOnly(zohoData.Closing_Date) : "";

  const sapContactName = zohoData.Contact_Name?.name || "";
  const sapDescription = zohoData.Deal_Name;
  const sapPaymentTerms = getCode("PaymentTerms", zohoData.Payment_Terms);
  const sapPostingDate = zohoData.Creation_Date
    ? `${zohoData.Creation_Date}T00:00:00Z`
    : new Date().toISOString();
  const sapValidToDate = zohoData.Closing_Date
    ? `${zohoData.Closing_Date}T00:00:00Z`
    : new Date().toISOString();
  const sapEstimatedTimeline = zohoData.Estimated_Project_Timeline_in_months || 0;
  const sapTotalAmount = parseFloat(zohoData.Estimated_Revenue || 0).toFixed(1);
  const sapBackgroundIntroES = zohoData.Background_intro_ES || "";
  const sapZohoCode = zohoData.Deal_Code || "";
  const sapZohoDealID = zohoData.id || "";
  const sapAgreedFeesEN = zohoData.Agreed_fees_sales_quote_EN || "";
  const sapEndNotesES = zohoData.End_notes_sales_quote_ES || "";
  const sapEndNotesEN = zohoData.End_notes_sales_quote_EN || "";
  const sapBackgroundIntroEN = zohoData.Background_intro_EN || "";
  const sapBackground = zohoData.Background || "";
  const sapInvoicingTypeEN = zohoData.Invoicing_type_EN || "";
  const sapInvoicingTypeES = zohoData.Invoicing_type_ES || "";
  const sapProcedureCountry = zohoData.Procedure_country || "";
  const sapActiveSubstance = zohoData.Active_substance || "";
  const sapIndication = zohoData.Indication || "";
  const sapStandBy = zohoData.STAND_BY ? "true" : "false";
  const sapPricingType = getCode("PricingType", zohoData.Price_Type);
  const sapMailInvoiceRepository = zohoData.Mail_invoice_repository || "";
  const sapInvoiceEmails = zohoData.Invoicing_emails || "";
  const sapProbability = getCode("Probability", zohoData.Approval);
  const sapAcceptanceDate = zohoData.Acceptance_Date || "";
  const sapSendingDate = formatDateOnly(zohoData.Sent_to_the_client_date) || "";
  const sapProductType = getCode("ProjectType", zohoData.Project_Type);
  const sapSource = getCode("Source", zohoData.Source || zohoData.Lead_Source);
  const sapTechnicalUnit = getCode("TechnicalUnit", zohoData.Main_Technical_Unit);
  const sapTherapeuticalArea = getCode("TherapeuticalArea", zohoData.Therapeutical_area);
  const sapLegalBasis = getCode("LegalBasis", zohoData.Legal_Basis);
  const sapProcedure = getCode("Procedure", zohoData.Procedure);
  const sapHuntingFarming = getCode("HuntingFarming", zohoData.Hunting_Farming);
  const sapSalesUnit = getSalesUnit(zohoData.Main_Technical_Unit);
  const sapTypeOfProduct = getCode("TypeOfProduct", zohoData.Type_of_Product);

  let itemsXml = "";
  if (subformItems.length > 0) {
    subformItems.forEach((item, index) => {
      // Prefer a Zoho-provided S.NO if available (various API-name variants),
      // otherwise fall back to the positional fallback used previously.
      const possibleSno = item['S.NO'] || item.S_NO || item.SNo || item.S_No || item.Sno || item.SN || item.SN_No;
      let sapItemId = (index + 1) * 10;
      if (possibleSno) {
        const parsed = parseInt(String(possibleSno).replace(/\D+/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) sapItemId = parsed;
      }
      let productCode = "";
      if (item.Product_Code) {
        productCode = typeof item.Product_Code === 'object' ? item.Product_Code.name : item.Product_Code;
      }
      const quantity = item.Quantity || 1;
      const unitPrice = parseFloat(item.Unit_Price || 0).toFixed(2);
      const itemDiscount = parseFloat(item.Discount || 0).toFixed(2);
      const sapUoM = item.Unidad_de_medida || "";
      // const sapProcessingTypeCode = getCode("PricingType", item.Pricing_Type);
      const sapAccordingToFee = (item.According_to_Fee === true || item.According_to_Fee === "true") ? "true" : "false";
      const sapOptional = (item.Optional === true || item.Optional === "true") ? "true" : "false";
      const sapFootnotesEnglish = item.Footnotes_Ingles1 || item.Footnotes_Ingles || "";
      const sapFootnotesSpanish = item.Footnotes_Espa_ol || "";
      const sapActivityDescription = item.Activity_description || "";
      // const sapSalesForecast = parseFloat(item.Sales_Forecast || 0).toFixed(2);
      let finalFootnote = " ";
      if (isEnglish) {
        finalFootnote = sapFootnotesEnglish;
      } else if (isSpanish) {
        finalFootnote = sapFootnotesSpanish;
      } else {
        finalFootnote = sapFootnotesEnglish || sapFootnotesSpanish || " ";
      }
      
      if (productCode) {
        itemsXml += `
                <Items itemScheduleLineListCompleteTransmissionIndicator="true" actionCode="01">
                    <ID>${sapItemId}</ID>
                    <OptionalIndicator>${sapOptional}</OptionalIndicator>
                    <Description>${sapActivityDescription}</Description>
                    ${sapPricingType ? `<ProcessingTypeCode>${sapPricingType}</ProcessingTypeCode>` : ""}
                    <ItemProduct actionCode="01">
                        <ProductInternalID>${productCode}</ProductInternalID>
                        <UnitOfMeasure>${sapUoM}</UnitOfMeasure>
                    </ItemProduct>
                    
                    <ItemScheduleLine actionCode="01">
                        <Quantity unitCode="${sapUoM}">${quantity}</Quantity>
                    </ItemScheduleLine>
                    
                    <ProductRecipientItemParty actionCode="01">
                        <PartyID>${accountId}</PartyID>
                    </ProductRecipientItemParty>
                    
                    <PriceAndTaxCalculationItem actionCode="01" 
                        itemPriceComponentListCompleteTransmissionIndicator="true"
                        itemProductTaxDetailsListCompleteTransmissionIndicator="true">
                        ${itemDiscount > 0
            ? `
                        <ItemMainDiscount actionCode="01">
                            <Rate>
                                <DecimalValue>${itemDiscount}</DecimalValue>
                            </Rate>
                        </ItemMainDiscount>`
            : ""
          }
                        <ItemMainPrice actionCode="01">
                            <Rate>
                                <DecimalValue>${unitPrice}</DecimalValue>
                                <CurrencyCode>EUR</CurrencyCode>
                                <BaseDecimalValue>1.0</BaseDecimalValue>
                                <BaseMeasureUnitCode>${sapUoM}</BaseMeasureUnitCode>
                            </Rate>
                        </ItemMainPrice> 
                    </PriceAndTaxCalculationItem>
                    <ItemTextCollection actionCode="01">
                            <Text>
                                <TypeCode>10024</TypeCode>
                                <ContentText>${finalFootnote}</ContentText>
                            </Text>
                        </ItemTextCollection>
                    <a3z:EstimacionIngresos currencyCode="EUR">${sapTotalAmount}</a3z:EstimacionIngresos>
                    <a3z:Segntarifa>${sapAccordingToFee}</a3z:Segntarifa>
                    ${sapFootnotesEnglish ? `<a3z:NotasalpieEN><![CDATA[${sapFootnotesEnglish}]]></a3z:NotasalpieEN>` : ""}
                    <a3z:Ingresos0>false</a3z:Ingresos0>
                </Items>
                `;
      }
    });
  }
// <SubmitIndicator>true</SubmitIndicator> on line after <CashDiscountTermsCode>${sapPaymentTerms}</CashDiscountTermsCode>
// Item level Sales Forecast
//  <ItemProductTaxDetails actionCode="01">
//                             <TransactionCurrencyProductTax actionCode="01">
//                                 <BaseAmount currencyCode="EUR">${sapSalesForecast}</BaseAmount>
//                             </TransactionCurrencyProductTax>
//                         </ItemProductTaxDetails>
  return `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global" xmlns:a3z="http://sap.com/xi/AP/CustomerExtension/BYD/A3Z5O">
   <soap:Header/>
   <soap:Body>
      <glob:CustomerQuoteBundleMaintainRequest_sync>
         <CustomerQuote itemListCompleteTransmissionIndicator="true">
            <PostingDate>${sapPostingDate}</PostingDate>
            <Name languageCode="EN">${sapDescription}</Name>
            <CashDiscountTermsCode>${sapPaymentTerms}</CashDiscountTermsCode>
            <SubmitIndicator>true</SubmitIndicator>
            <SalesAndServiceBusinessArea actionCode="01">
               <DistributionChannelCode>01</DistributionChannelCode> 
            </SalesAndServiceBusinessArea>

            <AccountParty>
               <PartyID>${accountId}</PartyID>
            </AccountParty>

            <SalesUnitParty actionCode="01">
               <PartyID>${sapSalesUnit}</PartyID>
            </SalesUnitParty>

            <ValidityPeriodPeriodTerms>
               <StartDateTime timeZoneCode="CET">${sapPostingDate}</StartDateTime>
               <EndDateTime timeZoneCode="CET">${sapValidToDate}</EndDateTime>
            </ValidityPeriodPeriodTerms>

            <PricingTerms>
              <CurrencyCode>EUR</CurrencyCode>
              <GrossAmountIndicator>false</GrossAmountIndicator>
            </PricingTerms>
            ${sapAcceptanceDate ? `<a3z:Fechadeaceptacin>${sapAcceptanceDate}</a3z:Fechadeaceptacin>` : ""}
            ${itemsXml}
            ${sapProbability ? `<a3z:ProbabilidadOfertaAsphalion>${sapProbability}</a3z:ProbabilidadOfertaAsphalion>` : ""}
            <a3z:DEALreferenceZOHO>${sapZohoOwnerName}</a3z:DEALreferenceZOHO>
            <a3z:ZohoDealID>${sapZohoCode}</a3z:ZohoDealID>
            ${sapSendingDate ? `<a3z:Fechadeenvo>${sapSendingDate}</a3z:Fechadeenvo>` : ""}
            ${sapLossDate ? `<a3z:Fechadeperdida>${sapLossDate}</a3z:Fechadeperdida>` : ""}
            <a3z:Personadecontacto>${sapContactName}</a3z:Personadecontacto>
            <a3z:DuracionProyectoEstimada>${sapEstimatedTimeline}</a3z:DuracionProyectoEstimada>
            <a3z:Discount>${subformItems.some(item => (item.Discount && parseFloat(item.Discount) > 0)) ? "true" : "false"}</a3z:Discount>
            
            ${sapProductType ? `<a3z:TipodeProyecto>${sapProductType}</a3z:TipodeProyecto>` : ""}
            ${sapSource ? `<a3z:Origen>${sapSource}</a3z:Origen>` : ""}
            ${sapTechnicalUnit ? `<a3z:Categoria>${sapTechnicalUnit}</a3z:Categoria>` : ""}
            ${sapTherapeuticalArea ? `<a3z:reateraputica>${sapTherapeuticalArea}</a3z:reateraputica>` : ""}
            ${sapLegalBasis ? `<a3z:Baselegal>${sapLegalBasis}</a3z:Baselegal>` : ""}
            ${sapProcedure ? `<a3z:Procedimiento1>${sapProcedure}</a3z:Procedimiento1>` : ""}
            ${sapHuntingFarming ? `<a3z:HuntingFarming>${sapHuntingFarming}</a3z:HuntingFarming>` : ""}
            ${sapTypeOfProduct ? `<a3z:Tipodeproducto>${sapTypeOfProduct}</a3z:Tipodeproducto>` : ""}
            
            ${sapBackgroundIntroES ? `<a3z:BackgroundBymeans><![CDATA[${sapBackgroundIntroES}]]></a3z:BackgroundBymeans>` : ""}
            ${sapAgreedFeesEN ? `<a3z:AgreedfeessalesquoteEN><![CDATA[${sapAgreedFeesEN}]]></a3z:AgreedfeessalesquoteEN>` : ""}
            ${sapEndNotesES ? `<a3z:Footnotes1><![CDATA[${sapEndNotesES}]]></a3z:Footnotes1>` : ""}
            ${sapEndNotesEN ? `<a3z:EndnotessalesquoteEN><![CDATA[${sapEndNotesEN}]]></a3z:EndnotessalesquoteEN>` : ""}
            ${sapBackgroundIntroEN ? `<a3z:BackgroundintroEN><![CDATA[${sapBackgroundIntroEN}]]></a3z:BackgroundintroEN>` : ""}
            ${sapBackground ? `<a3z:Background1><![CDATA[${sapBackground}]]></a3z:Background1>` : ""}
            ${sapInvoicingTypeEN ? `<a3z:InvoicingtypeEN><![CDATA[${sapInvoicingTypeEN}]]></a3z:InvoicingtypeEN>` : ""}
            ${sapInvoicingTypeES ? `<a3z:InvoicingtypeES><![CDATA[${sapInvoicingTypeES}]]></a3z:InvoicingtypeES>` : ""}
            ${sapProcedureCountry ? `<a3z:Pasdelprocedimiento><![CDATA[${sapProcedureCountry}]]></a3z:Pasdelprocedimiento>` : ""}
            ${sapActiveSubstance ? `<a3z:Sustanciaactiva1><![CDATA[${sapActiveSubstance}]]></a3z:Sustanciaactiva1>` : ""}
            ${sapMailInvoiceRepository ? `<a3z:Repositoriocorreosdefacturacin><![CDATA[${sapMailInvoiceRepository}]]></a3z:Repositoriocorreosdefacturacin>` : ""}
            ${sapIndication ? `<a3z:Indicacin><![CDATA[${sapIndication}]]></a3z:Indicacin>` : ""}
            ${sapInvoiceEmails ? `<a3z:Correosdefacturacin><![CDATA[${sapInvoiceEmails}]]></a3z:Correosdefacturacin>` : ""}
            <a3z:STANDBY>${sapStandBy}</a3z:STANDBY>
           <a3z:ProbabilidadOfertaAsphalion>107</a3z:ProbabilidadOfertaAsphalion>
         </CustomerQuote>
      </glob:CustomerQuoteBundleMaintainRequest_sync>
   </soap:Body>
</soap:Envelope>
    `.trim();
};
// ${sapAcceptanceDate ? `<a3z:Fechadeaceptacin>${sapAcceptanceDate}</a3z:Fechadeaceptacin>` : ""} line 376
module.exports = { buildSapXmlPayload };