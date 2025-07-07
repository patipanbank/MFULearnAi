import { AppConfig, appConfig } from './app.config';
import { AuthConfig, authConfig } from './auth.config';
import { DatabaseConfig, databaseConfig } from './database.config';

export interface Configuration {
  app: AppConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
}

export const configuration = (): Configuration => ({
  app: appConfig(),
  auth: authConfig(),
  database: databaseConfig(),
});

// Export individual configurations
export { AppConfig, appConfig } from './app.config';
export { AuthConfig, authConfig } from './auth.config';
export { DatabaseConfig, databaseConfig } from './database.config';

// Default export
export default configuration; 