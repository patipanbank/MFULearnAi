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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let DepartmentService = class DepartmentService {
    constructor(deptModel) {
        this.deptModel = deptModel;
    }
    async findAll() {
        return this.deptModel.find().sort({ name: 1 }).lean();
    }
    async findById(id) {
        const dept = await this.deptModel.findById(id).lean();
        if (!dept)
            throw new common_1.NotFoundException('Department not found');
        return dept;
    }
    async findByName(name) {
        return this.deptModel.findOne({ name: name.toLowerCase().trim() }).lean();
    }
    async create(dto) {
        try {
            const created = new this.deptModel({ ...dto, name: dto.name.toLowerCase().trim() });
            return await created.save();
        }
        catch (err) {
            if (err.code === 11000) {
                throw new common_1.ConflictException('Department with this name already exists');
            }
            throw err;
        }
    }
    async update(id, dto) {
        const updates = { ...dto };
        if (updates.name) {
            updates.name = updates.name.toLowerCase().trim();
        }
        const updated = await this.deptModel.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });
        if (!updated)
            throw new common_1.NotFoundException('Department not found');
        return updated;
    }
    async delete(id) {
        const deleted = await this.deptModel.findByIdAndDelete(id).lean();
        if (!deleted)
            throw new common_1.NotFoundException('Department not found');
        return deleted;
    }
};
exports.DepartmentService = DepartmentService;
exports.DepartmentService = DepartmentService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('Department')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], DepartmentService);
//# sourceMappingURL=department.service.js.map