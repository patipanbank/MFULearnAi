import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface SecurityHeadersConfig {
  // Content Security Policy
  contentSecurityPolicy?: {
    directives?: {
      defaultSrc?: string[];
      scriptSrc?: string[];
      styleSrc?: string[];
      fontSrc?: string[];
      imgSrc?: string[];
      connectSrc?: string[];
      mediaSrc?: string[];
      objectSrc?: string[];
      childSrc?: string[];
      frameSrc?: string[];
      workerSrc?: string[];
      frameAncestors?: string[];
      formAction?: string[];
      upgradeInsecureRequests?: boolean;
      blockAllMixedContent?: boolean;
    };
    reportOnly?: boolean;
  };
  
  // HTTP Strict Transport Security
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  
  // X-Frame-Options
  frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | false;
  
  // X-Content-Type-Options
  noSniff?: boolean;
  
  // X-XSS-Protection
  xssProtection?: boolean;
  
  // Referrer-Policy
  referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
  
  // Feature-Policy / Permissions-Policy
  permissionsPolicy?: Record<string, string[]>;
  
  // Remove server information
  removeServerHeader?: boolean;
  
  // Remove X-Powered-By
  removePoweredBy?: boolean;
  
  // Custom headers
  customHeaders?: Record<string, string>;
}

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SecurityHeadersMiddleware.name);
  
  private readonly defaultConfig: SecurityHeadersConfig = {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:', 'https:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        childSrc: ["'self'"],
        frameSrc: ["'self'"],
        workerSrc: ["'self'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: true,
        blockAllMixedContent: true
      },
      reportOnly: false
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    frameOptions: 'DENY',
    noSniff: true,
    xssProtection: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      'camera': [],
      'microphone': [],
      'geolocation': [],
      'payment': [],
      'usb': [],
      'magnetometer': [],
      'gyroscope': [],
      'accelerometer': []
    },
    removeServerHeader: true,
    removePoweredBy: true,
    customHeaders: {
      'X-API-Version': '1.0',
      'X-Request-ID': ''  // Will be generated per request
    }
  };

  use(req: Request, res: Response, next: NextFunction) {
    this.applySecurityHeaders(req, res, next, this.defaultConfig);
  }

  /**
   * Create security headers middleware with custom configuration
   */
  static create(config: Partial<SecurityHeadersConfig>) {
    return (req: Request, res: Response, next: NextFunction) => {
      const middleware = new SecurityHeadersMiddleware();
      const finalConfig = { ...middleware.defaultConfig, ...config };
      middleware.applySecurityHeaders(req, res, next, finalConfig);
    };
  }

  /**
   * Apply security headers
   */
  private applySecurityHeaders(
    req: Request,
    res: Response,
    next: NextFunction,
    config: SecurityHeadersConfig
  ) {
    try {
      // Content Security Policy
      if (config.contentSecurityPolicy) {
        const csp = this.buildCSP(config.contentSecurityPolicy);
        const headerName = config.contentSecurityPolicy.reportOnly 
          ? 'Content-Security-Policy-Report-Only'
          : 'Content-Security-Policy';
        res.setHeader(headerName, csp);
      }

      // HTTP Strict Transport Security
      if (config.hsts && req.secure) {
        const hsts = this.buildHSTS(config.hsts);
        res.setHeader('Strict-Transport-Security', hsts);
      }

      // X-Frame-Options
      if (config.frameOptions) {
        res.setHeader('X-Frame-Options', config.frameOptions);
      }

      // X-Content-Type-Options
      if (config.noSniff) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }

      // X-XSS-Protection
      if (config.xssProtection) {
        res.setHeader('X-XSS-Protection', '1; mode=block');
      }

      // Referrer-Policy
      if (config.referrerPolicy) {
        res.setHeader('Referrer-Policy', config.referrerPolicy);
      }

      // Permissions-Policy
      if (config.permissionsPolicy) {
        const permissionsPolicy = this.buildPermissionsPolicy(config.permissionsPolicy);
        res.setHeader('Permissions-Policy', permissionsPolicy);
      }

      // Remove server information
      if (config.removeServerHeader) {
        res.removeHeader('Server');
      }

      // Remove X-Powered-By
      if (config.removePoweredBy) {
        res.removeHeader('X-Powered-By');
      }

      // Custom headers
      if (config.customHeaders) {
        Object.entries(config.customHeaders).forEach(([key, value]) => {
          if (key === 'X-Request-ID') {
            // Generate unique request ID
            const requestId = this.generateRequestId();
            res.setHeader(key, requestId);
            (req as any).requestId = requestId;
          } else if (value) {
            res.setHeader(key, value);
          }
        });
      }

      // Add security-related headers for API responses
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      this.logger.debug(`Security headers applied for ${req.method} ${req.url}`);
      next();
    } catch (error) {
      this.logger.error('Error applying security headers:', error);
      next(); // Continue even if security headers fail
    }
  }

  /**
   * Build Content Security Policy string
   */
  private buildCSP(csp: SecurityHeadersConfig['contentSecurityPolicy']): string {
    if (!csp || !csp.directives) return '';

    const directives: string[] = [];
    
    Object.entries(csp.directives).forEach(([key, value]) => {
      if (key === 'upgradeInsecureRequests' && value) {
        directives.push('upgrade-insecure-requests');
      } else if (key === 'blockAllMixedContent' && value) {
        directives.push('block-all-mixed-content');
      } else if (Array.isArray(value)) {
        const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        directives.push(`${directive} ${value.join(' ')}`);
      }
    });

    return directives.join('; ');
  }

  /**
   * Build HSTS string
   */
  private buildHSTS(hsts: SecurityHeadersConfig['hsts']): string {
    if (!hsts) return '';

    let value = `max-age=${hsts.maxAge || 31536000}`;
    
    if (hsts.includeSubDomains) {
      value += '; includeSubDomains';
    }
    
    if (hsts.preload) {
      value += '; preload';
    }

    return value;
  }

  /**
   * Build Permissions-Policy string
   */
  private buildPermissionsPolicy(policy: Record<string, string[]>): string {
    const directives: string[] = [];
    
    Object.entries(policy).forEach(([feature, allowlist]) => {
      if (allowlist.length === 0) {
        directives.push(`${feature}=()`);
      } else {
        const origins = allowlist.map(origin => 
          origin === 'self' ? 'self' : `"${origin}"`
        ).join(' ');
        directives.push(`${feature}=(${origins})`);
      }
    });

    return directives.join(', ');
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Pre-configured security header middlewares
 */
export class SecurityHeadersPresets {
  
  /**
   * Strict security headers for production
   */
  static strict() {
    return SecurityHeadersMiddleware.create({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          mediaSrc: ["'none'"],
          objectSrc: ["'none'"],
          childSrc: ["'none'"],
          frameSrc: ["'none'"],
          workerSrc: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: true,
          blockAllMixedContent: true
        }
      },
      frameOptions: 'DENY',
      removeServerHeader: true,
      removePoweredBy: true
    });
  }

  /**
   * Moderate security headers for development
   */
  static moderate() {
    return SecurityHeadersMiddleware.create({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:', 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
          frameAncestors: ["'self'"]
        }
      },
      frameOptions: 'SAMEORIGIN',
      removeServerHeader: true,
      removePoweredBy: true
    });
  }

  /**
   * Lenient security headers for API endpoints
   */
  static api() {
    return SecurityHeadersMiddleware.create({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", 'https:', 'wss:', 'ws:']
        }
      },
      frameOptions: 'DENY',
      noSniff: true,
      xssProtection: true,
      removeServerHeader: true,
      removePoweredBy: true,
      customHeaders: {
        'X-API-Version': '1.0',
        'X-Request-ID': ''
      }
    });
  }

  /**
   * Minimal security headers for health checks
   */
  static minimal() {
    return SecurityHeadersMiddleware.create({
      removeServerHeader: true,
      removePoweredBy: true,
      customHeaders: {
        'X-Health-Check': 'true'
      }
    });
  }
} 