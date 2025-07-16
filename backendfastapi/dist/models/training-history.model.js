"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingHistorySchema = exports.TrainingHistory = exports.TrainingAction = void 0;
const mongoose_1 = require("@nestjs/mongoose");
var TrainingAction;
(function (TrainingAction) {
    TrainingAction["UPLOAD"] = "upload";
    TrainingAction["DELETE"] = "delete";
    TrainingAction["CREATE_COLLECTION"] = "create_collection";
    TrainingAction["UPDATE_COLLECTION"] = "update_collection";
    TrainingAction["DELETE_COLLECTION"] = "delete_collection";
})(TrainingAction || (exports.TrainingAction = TrainingAction = {}));
let TrainingHistory = class TrainingHistory {
    userId;
    username;
    collectionName;
    documentName;
    action;
    timestamp;
    details;
};
exports.TrainingHistory = TrainingHistory;
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], TrainingHistory.prototype, "userId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], TrainingHistory.prototype, "username", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], TrainingHistory.prototype, "collectionName", void 0);
__decorate([
    (0, mongoose_1.Prop)(),
    __metadata("design:type", String)
], TrainingHistory.prototype, "documentName", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true, enum: TrainingAction }),
    __metadata("design:type", String)
], TrainingHistory.prototype, "action", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: Date.now }),
    __metadata("design:type", Date)
], TrainingHistory.prototype, "timestamp", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object }),
    __metadata("design:type", Object)
], TrainingHistory.prototype, "details", void 0);
exports.TrainingHistory = TrainingHistory = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        collection: 'training_history',
        toJSON: {
            virtuals: true,
            transform: function (doc, ret) {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    })
], TrainingHistory);
exports.TrainingHistorySchema = mongoose_1.SchemaFactory.createForClass(TrainingHistory);
exports.TrainingHistorySchema.index({ userId: 1, timestamp: -1 });
exports.TrainingHistorySchema.index({ collectionName: 1, timestamp: -1 });
exports.TrainingHistorySchema.index({ action: 1, timestamp: -1 });
//# sourceMappingURL=training-history.model.js.map