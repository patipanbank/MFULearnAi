"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionModel = exports.CollectionPermission = void 0;
const mongoose_1 = require("mongoose");
var CollectionPermission;
(function (CollectionPermission) {
    CollectionPermission["PUBLIC"] = "PUBLIC";
    CollectionPermission["PRIVATE"] = "PRIVATE";
})(CollectionPermission || (exports.CollectionPermission = CollectionPermission = {}));
const collectionSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String },
    summary: { type: String },
    permission: { type: String, required: true },
    createdBy: { type: String, required: true },
    // add default values if needed
}, { timestamps: true });
exports.CollectionModel = (0, mongoose_1.model)('Collection', collectionSchema);
