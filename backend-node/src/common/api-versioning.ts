import { VersioningType } from '@nestjs/common';

export interface ApiVersionConfig {
  type: VersioningType;
  defaultVersion?: string | string[];
  prefix?: string;
  header?: string;
  customExtractor?: (request: any) => string | string[] | undefined;
}

export class ApiVersioning {
  /**
   * Get default API versioning configuration
   */
  static getDefaultConfig(): ApiVersionConfig {
    return {
      type: VersioningType.URI,
      defaultVersion: '1',
      prefix: 'v',
    };
  }

  /**
   * Get header-based versioning configuration
   */
  static getHeaderConfig(header: string = 'X-API-Version'): ApiVersionConfig {
    return {
      type: VersioningType.HEADER,
      defaultVersion: '1',
      header,
    };
  }

  /**
   * Get custom versioning configuration
   */
  static getCustomConfig(extractor: (request: any) => string | string[] | undefined): ApiVersionConfig {
    return {
      type: VersioningType.CUSTOM,
      defaultVersion: '1',
      customExtractor: extractor,
    };
  }

  /**
   * Get media type versioning configuration
   */
  static getMediaTypeConfig(): ApiVersionConfig {
    return {
      type: VersioningType.MEDIA_TYPE,
      defaultVersion: '1',
    };
  }

  /**
   * Custom extractor for query parameter versioning
   */
  static queryParamExtractor(paramName: string = 'version') {
    return (request: any) => {
      return request.query?.[paramName];
    };
  }

  /**
   * Custom extractor for subdomain versioning
   */
  static subdomainExtractor() {
    return (request: any) => {
      const host = request.headers.host;
      if (!host) return undefined;
      
      const parts = host.split('.');
      if (parts.length > 2) {
        const subdomain = parts[0];
        const versionMatch = subdomain.match(/^v(\d+)$/);
        return versionMatch ? versionMatch[1] : undefined;
      }
      return undefined;
    };
  }

  /**
   * Custom extractor for Accept header versioning
   */
  static acceptHeaderExtractor() {
    return (request: any) => {
      const accept = request.headers.accept;
      if (!accept) return undefined;
      
      const versionMatch = accept.match(/application\/vnd\.mfu\.v(\d+)\+json/);
      return versionMatch ? versionMatch[1] : undefined;
    };
  }
}

/**
 * Version-specific decorators and utilities
 */
export const ApiVersions = {
  V1: '1',
  V2: '2',
  V3: '3',
  LATEST: '3',
  BETA: 'beta',
  ALPHA: 'alpha',
} as const;

export type ApiVersion = typeof ApiVersions[keyof typeof ApiVersions];

/**
 * Deprecated API versions
 */
export const DeprecatedVersions = {
  V1: {
    version: '1',
    deprecatedAt: '2024-01-01',
    sunsetAt: '2024-12-31',
    message: 'API v1 is deprecated. Please migrate to v2 or higher.',
  },
} as const;

/**
 * Version compatibility matrix
 */
export const VersionCompatibility = {
  '1': {
    supportedUntil: '2024-12-31',
    recommendedMigration: '2',
    features: ['basic-auth', 'simple-chat'],
  },
  '2': {
    supportedUntil: '2025-12-31',
    recommendedMigration: '3',
    features: ['jwt-auth', 'advanced-chat', 'file-upload'],
  },
  '3': {
    supportedUntil: '2026-12-31',
    recommendedMigration: null,
    features: ['oauth2', 'websocket', 'ai-agents', 'real-time-collaboration'],
  },
  'beta': {
    supportedUntil: '2024-06-30',
    recommendedMigration: '3',
    features: ['experimental-features'],
  },
} as const;

/**
 * Get version info
 */
export function getVersionInfo(version: string) {
  return VersionCompatibility[version as keyof typeof VersionCompatibility];
}

/**
 * Check if version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  const versionInfo = getVersionInfo(version);
  if (!versionInfo) return false;
  
  const supportedUntil = new Date(versionInfo.supportedUntil);
  const now = new Date();
  
  return now > supportedUntil;
}

/**
 * Get deprecation warning message
 */
export function getDeprecationWarning(version: string): string | null {
  const versionInfo = getVersionInfo(version);
  if (!versionInfo) return null;
  
  const supportedUntil = new Date(versionInfo.supportedUntil);
  const now = new Date();
  const daysUntilSunset = Math.ceil((supportedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilSunset <= 90 && daysUntilSunset > 0) {
    return `API version ${version} will be deprecated in ${daysUntilSunset} days. Please migrate to version ${versionInfo.recommendedMigration}.`;
  }
  
  if (daysUntilSunset <= 0) {
    return `API version ${version} is deprecated. Please migrate to version ${versionInfo.recommendedMigration}.`;
  }
  
  return null;
} 