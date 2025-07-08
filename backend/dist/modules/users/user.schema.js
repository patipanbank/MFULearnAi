"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSchema = void 0;
const mongoose_1 = require("mongoose");
const bcryptjs_1 = require("bcryptjs");
const UserSchema = new mongoose_1.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    roles: [{ type: String, required: true }],
    department: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String },
});
exports.UserSchema = UserSchema;
UserSchema.pre('save', async function (next) {
    const user = this;
    if (!user.isModified('password'))
        return next();
    const salt = await bcryptjs_1.default.genSalt(10);
    user.password = await bcryptjs_1.default.hash(user.password, salt);
    next();
});
UserSchema.methods.comparePassword = async function (cand) {
    return bcryptjs_1.default.compare(cand, this.password);
};
//# sourceMappingURL=user.schema.js.map