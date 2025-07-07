"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfig = exports.authConfig = exports.appConfig = exports.configuration = void 0;
const app_config_1 = require("./app.config");
const auth_config_1 = require("./auth.config");
const database_config_1 = require("./database.config");
const configuration = () => ({
    app: (0, app_config_1.appConfig)(),
    auth: (0, auth_config_1.authConfig)(),
    database: (0, database_config_1.databaseConfig)(),
});
exports.configuration = configuration;
var app_config_2 = require("./app.config");
Object.defineProperty(exports, "appConfig", { enumerable: true, get: function () { return app_config_2.appConfig; } });
var auth_config_2 = require("./auth.config");
Object.defineProperty(exports, "authConfig", { enumerable: true, get: function () { return auth_config_2.authConfig; } });
var database_config_2 = require("./database.config");
Object.defineProperty(exports, "databaseConfig", { enumerable: true, get: function () { return database_config_2.databaseConfig; } });
exports.default = exports.configuration;
//# sourceMappingURL=index.js.map