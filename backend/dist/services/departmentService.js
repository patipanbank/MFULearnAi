"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensure_department_exists = void 0;
const mongodb_1 = require("../lib/mongodb");
const ensure_department_exists = async (department_name) => {
    if (!department_name)
        return;
    const db = (0, mongodb_1.getDatabase)();
    if (!db) {
        throw new Error('Database not connected');
    }
    const collection = db.collection('departments');
    const existing = await collection.findOne({ name: department_name.toLowerCase() });
    if (!existing) {
        await collection.insertOne({
            name: department_name.toLowerCase(),
            displayName: department_name,
            created: new Date(),
            updated: new Date()
        });
    }
};
exports.ensure_department_exists = ensure_department_exists;
//# sourceMappingURL=departmentService.js.map