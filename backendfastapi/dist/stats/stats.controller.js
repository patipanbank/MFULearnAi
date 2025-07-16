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
const passport_1 = require("@nestjs/passport");
const stats_service_1 = require("./stats.service");
const class_validator_1 = require("class-validator");
class GetStatsQueryDto {
    start_date;
    end_date;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GetStatsQueryDto.prototype, "start_date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GetStatsQueryDto.prototype, "end_date", void 0);
let StatsController = class StatsController {
    statsService;
    constructor(statsService) {
        this.statsService = statsService;
    }
    async getDailyStats(req, query) {
        if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
            throw new common_1.ForbiddenException('Admin privileges required');
        }
        try {
            const stats = await this.statsService.getDailyStats(query.start_date, query.end_date);
            return stats;
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get daily stats');
        }
    }
    async getTotalStats(req) {
        if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
            throw new common_1.ForbiddenException('Admin privileges required');
        }
        try {
            const totalStats = await this.statsService.getTotalStats();
            return totalStats;
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get total stats');
        }
    }
    async getDailyChatStats(req) {
        if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
            throw new common_1.ForbiddenException('Admin privileges required');
        }
        try {
            const dailyStats = await this.statsService.getDailyChatStats();
            return dailyStats;
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get daily chat stats');
        }
    }
    async getUserStats(req) {
        try {
            const userStats = await this.statsService.getUserStats(req.user.id);
            return userStats;
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get user stats');
        }
    }
    async getSystemHealth(req) {
        if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
            throw new common_1.ForbiddenException('Admin privileges required');
        }
        try {
            const health = await this.statsService.getSystemHealth();
            return health;
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get system health');
        }
    }
};
exports.StatsController = StatsController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, GetStatsQueryDto]),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getDailyStats", null);
__decorate([
    (0, common_1.Get)('total'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getTotalStats", null);
__decorate([
    (0, common_1.Get)('daily'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getDailyChatStats", null);
__decorate([
    (0, common_1.Get)('user'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getUserStats", null);
__decorate([
    (0, common_1.Get)('health'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "getSystemHealth", null);
exports.StatsController = StatsController = __decorate([
    (0, common_1.Controller)('stats'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [stats_service_1.StatsService])
], StatsController);
//# sourceMappingURL=stats.controller.js.map