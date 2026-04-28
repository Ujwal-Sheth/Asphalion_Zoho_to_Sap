const SAP_MAPS = require('../constants/sapMaps');

// Helper function to safely get a mapped code, returning a fallback if not found
const getCode = (mapName, zohoValue, fallback = "") => {
  if (!zohoValue) return fallback;
  return SAP_MAPS[mapName][zohoValue] || fallback;
};

const getSalesUnit = (categoryText) => {
  const salesUnitMapping = {
    "eSub RegOps": "1170", // AS_eSub RegOps
    "DATA RegOps": "1190", // AS_DATA RegOps
    CMC: "1101", // AS_CMC
    DW: "1150", // AS_DW
    MedTech: "1130", // AS_MD
    LCM: "1102", // AS_LCM
    PV: "1160", // AS_PV
    "Business Development": "1310", // AS_BD
    Others: "1180", // AS_OTHERS
  };

  // Return the mapped code, or default to "1180" (AS_OTHERS) if no match is found
  return salesUnitMapping[categoryText] || "1180";
};

const buildSapXmlPayload = (zohoData, accountId) => {
  // --- FIXED VARIABLES FOR TESTING ---
  // const fixedProductId = "1000001717";
  const sapDescription = zohoData.Description || zohoData.Deal_Name;
  const sapPostingDate = zohoData.Creation_Date
    ? `${zohoData.Creation_Date}T00:00:00Z`
    : new Date().toISOString();
  const sapValidToDate = zohoData.Closing_Date
    ? `${zohoData.Closing_Date}T00:00:00Z`
    : new Date().toISOString();
  const sapEstimatedTimeline =
    zohoData.Estimated_Project_Timeline_in_months || 0;
  const sapContactName = zohoData.Contact_Name?.name || "Unknown Contact";
  const sapTotalAmount = parseFloat(zohoData.Estimated_Revenue || 0).toFixed(
    1,
  );

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
  const sapStandBy = zohoData.STAND_BY ? "true" : "false";

  const sapMailInvoiceRepository = zohoData.Mail_invoice_repository || "";
  const sapInvoiceEmails = zohoData.Invoicing_emails || "";

  const sapProductType = getCode("ProjectType", zohoData.Project_Type);
  const sapSource = getCode("Source", zohoData.Source || zohoData.Lead_Source);
  const sapTechnicalUnit = getCode("TechnicalUnit", zohoData.Main_Technical_Unit);
  const sapTherapeuticalArea = getCode(
    "TherapeuticalArea",
    zohoData.Therapeutical_area,
  );
  const sapLegalBasis = getCode("LegalBasis", zohoData.Legal_Basis);
  const sapProcedure = getCode("Procedure", zohoData.Procedure);
  const sapHuntingFarming = getCode("HuntingFarming", zohoData.Hunting_Farming);
  const sapPaymentTerms = getCode("PaymentTerms", zohoData.Payment_Terms);
  const sapSalesUnit = getSalesUnit(zohoData.Main_Technical_Unit);
  // const sapProbability = getCode("Probability", zohoData.Chance_Of_Success_Aspalion);
  const sapTypeOfProduct = getCode("TypeOfProduct", zohoData.Type_of_Product);

  // const productTotal = parseFloat(zohoData.Total || 0).toFixed(2);

  let itemsXml = "";
  const subformItems = zohoData.Product_Details || [];
  // console.log(`Building XML Payload: Found ${subformItems.length} items in Product_Details subform.`);
  if (subformItems.length > 0) {
    subformItems.forEach((item, index) => {
      const sapItemId = (index + 1) * 10;
      const productCode = item.Product_Code || "";
      const quantity = item.Quantity || 1;
      const unitPrice = parseFloat(item.Unit_Price || 0).toFixed(2);
      // const productTotal = parseFloat(item.Product_Total || (quantity * unitPrice)).toFixed(2);
      const itemDiscount = item.Discount || 0;
      const sapUoM = item.Unidad_de_medida || "";
      const sapProcessingTypeCode = getCode("PricingType", item.Pricing_Type);
      const sapAccordingToFee = (item.According_to_Fee === true || item.According_to_Fee === "true") ? "true" : "false";
      const sapOptional = (item.Optional === true || item.Optional === "true") ? "true" : "false";

      if (productCode) {
        itemsXml += `
                <Items itemScheduleLineListCompleteTransmissionIndicator="true" actionCode="01">
                    <ID>${sapItemId}</ID>
                    <OptionalIndicator>${sapOptional}</OptionalIndicator>
                    <ItemProduct actionCode="01">
                        <ProductInternalID>${productCode}</ProductInternalID>
                        ${sapProcessingTypeCode ? `<ProcessingTypeCode>${sapProcessingTypeCode}</ProcessingTypeCode>` : ""}
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
                        ${
                          itemDiscount > 0
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
                    
                    <a3z:EstimacionIngresos currencyCode="EUR">${sapTotalAmount}</a3z:EstimacionIngresos>
                    <a3z:Segntarifa>${sapAccordingToFee}</a3z:Segntarifa>
                   
                    <a3z:Ingresos0>false</a3z:Ingresos0>
                </Items>
                `;
      }
    });
  }

  return `
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:glob="http://sap.com/xi/SAPGlobal20/Global" xmlns:a3z="http://sap.com/xi/AP/CustomerExtension/BYD/A3Z5O">
   <soap:Header/>
   <soap:Body>
      <glob:CustomerQuoteBundleMaintainRequest_sync>
         <CustomerQuote itemListCompleteTransmissionIndicator="true">
            
            <PostingDate>${sapPostingDate}</PostingDate>
            <Name languageCode="EN">${sapDescription}</Name>
            <CashDiscountTermsCode>${sapPaymentTerms}</CashDiscountTermsCode>
            
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
            
            ${itemsXml}
            <a3z:DEALreferenceZOHO>${zohoData.id}</a3z:DEALreferenceZOHO>
            <a3z:Personadecontacto>${sapContactName}</a3z:Personadecontacto>
            <a3z:DuracionProyectoEstimada>${sapEstimatedTimeline}</a3z:DuracionProyectoEstimada>
            <a3z:Discount>true</a3z:Discount>
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
// ${sapProbability ? `<a3z:ProbabilidadOfertaAsphalion>${sapProbability}</a3z:ProbabilidadOfertaAsphalion>` : ""}

module.exports = { buildSapXmlPayload };

// <BuyerID>${zohoData.id}</BuyerID>