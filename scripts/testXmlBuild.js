const { buildSapXmlPayload } = require('../utils/xmlBuilder');

// Small sample Zoho record with Product_Details subform rows.
const zohoData = {
  id: 'SAMPLE-DEAL-1',
  Deal_Name: 'Sample Deal',
  Product_Details: [
    { 'S.NO': '1', Product_Code: 'P001', Quantity: 2, Unit_Price: 10 },
    { S_NO: '2', Product_Code: 'P002', Quantity: 1, Unit_Price: 20 },
    { Sno: '3', Product_Code: 'P003', Quantity: 5, Unit_Price: 5 }
  ]
};

const xml = buildSapXmlPayload(zohoData, 'TEST_ACCOUNT', null);

// Print the generated Items blocks
const itemBlocks = xml.match(/<Items[\s\S]*?<\/Items>/g) || [];
console.log('Generated Items count:', itemBlocks.length);
itemBlocks.forEach((b, i) => {
  const idMatch = b.match(/<ID>(.*?)<\/ID>/);
  console.log(`Item ${i + 1} ID =>`, idMatch ? idMatch[1] : '(none)');
});
