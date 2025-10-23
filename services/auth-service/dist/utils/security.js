"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_password_hash = exports.verify_password = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const verify_password = (plain_password, hashed_password) => {
    return bcryptjs_1.default.compareSync(plain_password, hashed_password);
};
exports.verify_password = verify_password;
const get_password_hash = (password) => {
    return bcryptjs_1.default.hashSync(password, 10);
};
exports.get_password_hash = get_password_hash;
//# sourceMappingURL=security.js.map