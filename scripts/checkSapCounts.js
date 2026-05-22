require('dotenv').config();
const { getSapCustomers, getSapContacts } = require('../services/sapAccountContactService');

(async () => {
  try {
    console.log('Fetching SAP accounts...');
    const accounts = await getSapCustomers(null);
    console.log('SAP_ACCOUNTS_COUNT', Array.isArray(accounts) ? accounts.length : 0);

    console.log('Fetching SAP contacts...');
    const contacts = await getSapContacts(null);
    console.log('SAP_CONTACTS_COUNT', Array.isArray(contacts) ? contacts.length : 0);

    process.exit(0);
  } catch (err) {
    console.error('SAP_COUNT_ERROR', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
