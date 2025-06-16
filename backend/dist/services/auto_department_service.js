"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDepartmentExists = void 0;
const department_service_1 = require("./department_service");
/**
 * Ensure that a department exists by name.
 * If it doesn't exist, create it automatically.
 * @param departmentName The name of the department
 * @returns Boolean indicating if a new department was created
 */
const ensureDepartmentExists = async (departmentName) => {
    // Skip if department name is empty or not provided
    if (!departmentName || departmentName.trim() === '') {
        return false;
    }
    try {
        // Check if department already exists
        const existingDepartment = await (0, department_service_1.getDepartmentByName)(departmentName);
        if (existingDepartment) {
            // Department already exists, no need to create
            return false;
        }
        // Department doesn't exist, create it
        await (0, department_service_1.createDepartment)({
            name: departmentName,
            description: `Automatically created department for ${departmentName}`
        });
        console.log(`Automatically created department: ${departmentName}`);
        return true;
    }
    catch (error) {
        console.error(`Error ensuring department exists: ${error}`);
        return false;
    }
};
exports.ensureDepartmentExists = ensureDepartmentExists;
