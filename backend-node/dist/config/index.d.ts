import { AppConfig } from './app.config';
import { AuthConfig } from './auth.config';
import { DatabaseConfig } from './database.config';
export interface Configuration {
    app: AppConfig;
    auth: AuthConfig;
    database: DatabaseConfig;
}
export declare const configuration: () => Configuration;
export { AppConfig, appConfig } from './app.config';
export { AuthConfig, authConfig } from './auth.config';
export { DatabaseConfig, databaseConfig } from './database.config';
export default configuration;
