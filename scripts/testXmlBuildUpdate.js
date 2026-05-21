const { buildSapXmlPayload } = require('../utils/xmlBuilder');

const zohoData = {
  id: 'SAMPLE-DEAL-UPDATE',
  Deal_Name: 'Sample Deal Update',
  Estimated_Revenue: 123.45,
  Product_Details: [
    { 'S.NO': '10', Product_Code: 'P001', Quantity: 2, Unit_Price: 10 },
    { S_NO: '20', Product_Code: 'P002', Quantity: 1, Unit_Price: 20 }
  ]
};

const xml = buildSapXmlPayload(zohoData, 'TEST_ACCOUNT', 'SAP-QUOTE-1');
const itemBlocks = xml.match(/<Items[\s\S]*?<\/Items>/g) || [];
console.log('Generated Items count (update):', itemBlocks.length);
itemBlocks.forEach((b, i) => {
  const idMatch = b.match(/<ID>(.*?)<\/ID>/);
  console.log(`Item ${i + 1} ID =>`, idMatch ? idMatch[1] : '(none)');
});
