const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
    dealId: { type: String, required: true },
    accountId: { type: String, default: null },   
    sapQuoteId: { type: String, default: null },  
    logType: { type: String, enum: ['INFO','ERROR', 'WARNING'], required: true }, 
    stage: { type: String, required: true },
    messages: [{ type: String }],                 
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ErrorLog', ErrorLogSchema);