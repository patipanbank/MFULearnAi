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
exports.CollectionSchema = exports.Collection = exports.CollectionPermission = void 0;
const mongoose_1 = require("@nestjs/mongoose");
var CollectionPermission;
(function (CollectionPermission) {
    CollectionPermission["PUBLIC"] = "PUBLIC";
    CollectionPermission["PRIVATE"] = "PRIVATE";
    CollectionPermission["DEPARTMENT"] = "DEPARTMENT";
})(CollectionPermission || (exports.CollectionPermission = CollectionPermission = {}));
let Collection = class Collection {
    name;
    permission;
    createdBy;
    department;
    modelId;
    documentCount;
    size;
    createdAt;
    updatedAt;
    isActive;
    metadata;
};
exports.Collection = Collection;
__decorate([
    (0, mongoose_1.Prop)({ required: true, unique: true }),
    __metadata("design:type", String)
], Collection.prototype, "name", void 0);
__decorate([
    (0, mongoose_1.Prop)({
        type: String,
        enum: CollectionPermission,
        default: CollectionPermission.PRIVATE
    }),
    __metadata("design:type", String)
], Collection.prototype, "permission", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Collection.prototype, "createdBy", void 0);
__decorate([
    (0, mongoose_1.Prop)({ required: true }),
    __metadata("design:type", String)
], Collection.prototype, "department", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: null }),
    __metadata("design:type", String)
], Collection.prototype, "modelId", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Collection.prototype, "documentCount", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: 0 }),
    __metadata("design:type", Number)
], Collection.prototype, "size", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: Date.now }),
    __metadata("design:type", Date)
], Collection.prototype, "createdAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Date, default: Date.now }),
    __metadata("design:type", Date)
], Collection.prototype, "updatedAt", void 0);
__decorate([
    (0, mongoose_1.Prop)({ default: true }),
    __metadata("design:type", Boolean)
], Collection.prototype, "isActive", void 0);
__decorate([
    (0, mongoose_1.Prop)({ type: Object, default: {} }),
    __metadata("design:type", Object)
], Collection.prototype, "metadata", void 0);
exports.Collection = Collection = __decorate([
    (0, mongoose_1.Schema)({
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                ret.id = ret._id;
                delete ret._id;
                delete ret.__v;
                return ret;
            },
        },
    })
], Collection);
exports.CollectionSchema = mongoose_1.SchemaFactory.createForClass(Collection);
exports.CollectionSchema.index({ name: 1 });
exports.CollectionSchema.index({ permission: 1 });
exports.CollectionSchema.index({ createdBy: 1 });
exports.CollectionSchema.index({ createdAt: -1 });
exports.CollectionSchema.index({ isActive: 1 });
exports.CollectionSchema.index({ createdBy: 1, permission: 1 });
//# sourceMappingURL=collection.model.js.map