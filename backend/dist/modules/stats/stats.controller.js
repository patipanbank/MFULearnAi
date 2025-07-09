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
exports.StatsController = void 0;
const common_1 = require("@nestjs/common");
const stats_service_1 = require("./stats.service");
const jwt_guard_1 = require("../auth/jwt.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let StatsController = class StatsController {
    constructor(statsService) {
        this.statsService = statsService;
    }
    async getDailyStats(start, end) {
        return this.statsService.getDailyStats(start, end);
    }
    async total() {
        return this.statsService.getTotalStats();
    }
    async dailyChats() {
        return this.statsService.getDailyChatStats();
    }
};
exports.StatsController = StatsController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('SuperAdmin', 'Admin'),
    __param(0, (0, common_1.Query)('start_date')),
    __param(1, (0, common_1.Query)('end_date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getDailyStats", null);
__decorate([
    (0, common_1.Get)('total'),
    (0, roles_decorator_1.Roles)('SuperAdmin', 'Admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "total", null);
__decorate([
    (0, common_1.Get)('daily'),
    (0, roles_decorator_1.Roles)('SuperAdmin', 'Admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "dailyChats", null);
exports.StatsController = StatsController = __decorate([
    (0, common_1.Controller)({
        path: 'stats',
        version: '1'
    }),
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [stats_service_1.StatsService])
], StatsController);
//# sourceMappingURL=stats.controller.js.map