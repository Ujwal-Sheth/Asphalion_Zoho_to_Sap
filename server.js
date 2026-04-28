require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const bodyParser = require('body-parser');
const { runWeeklyReconciliation } = require('./cron/weeklySyncJob');
const syncController = require('./controllers/syncController');
const sharepointController = require('./controllers/sharepointController');
const { authenticateWebhook } = require('./middlewares/authMiddleware');

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// runWeeklyReconciliation();

//Sync Route
app.get('/api/sync-deal/:dealId', authenticateWebhook, syncController.syncDealToSap);
// app.post('/api/webhook/zoho-deal', authenticateWebhook, syncController.handleWebhook);

// 1. The SAP ByDesign Integration Route
app.post('/api/webhook/zoho-deal-to-sap', authenticateWebhook, syncController.handleWebhook);

// 2. The SharePoint Integration Route
app.post('/api/webhook/zoho-deal-sharepoint', authenticateWebhook, sharepointController.handleQuoteApproval);

app.post('/api/webhook/zoho-deal-draft', authenticateWebhook, sharepointController.handleDraftProposalSync);



// Connect to MongoDB
connectDB();


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running. Trigger sync at http://localhost:${PORT}/api/webhook/zoho-deal`);
});