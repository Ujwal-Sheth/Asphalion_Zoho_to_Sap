const { formatDateOnly } = require('../utils/dateUtils');
const { mapSapItemToZohoSubformItem } = require('../utils/sapMapper');

console.log("formatDateOnly(''): ", formatDateOnly(''));
console.log("formatDateOnly(' '): ", formatDateOnly(' '));
console.log("formatDateOnly(null): ", formatDateOnly(null));
console.log("formatDateOnly(undefined): ", formatDateOnly(undefined));

const sapItemFloat = {
    ItemScheduleLine: { Quantity: { _: '2.5' } }
};
console.log("mapSapItemToZohoSubformItem(float): ", mapSapItemToZohoSubformItem(sapItemFloat));

const sapItemEmptyQty = {
    ItemScheduleLine: { Quantity: { _: '' } }
};
console.log("mapSapItemToZohoSubformItem(empty qty): ", mapSapItemToZohoSubformItem(sapItemEmptyQty));
