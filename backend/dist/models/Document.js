"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentModel = exports.DocumentStatus = void 0;
const mongoose_1 = require("mongoose");
var DocumentStatus;
(function (DocumentStatus) {
    DocumentStatus["PENDING"] = "PENDING";
    DocumentStatus["PROCESSING"] = "PROCESSING";
    DocumentStatus["COMPLETED"] = "COMPLETED";
    DocumentStatus["FAILED"] = "FAILED";
})(DocumentStatus || (exports.DocumentStatus = DocumentStatus = {}));
const documentSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    collectionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Collection', required: true },
    summary: { type: String, default: '' },
    status: { type: String, enum: Object.values(DocumentStatus), default: DocumentStatus.PENDING },
    createdBy: { type: String, required: true },
}, { timestamps: true });
exports.DocumentModel = (0, mongoose_1.model)('Document', documentSchema);
