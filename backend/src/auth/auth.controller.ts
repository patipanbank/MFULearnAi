import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Res,
  HttpStatus,
  HttpException,
  Put,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { SAMLService } from './saml.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GetUser } from './decorators/get-user.decorator';

@Controller('auth')
export class AuthController {
  private readonly loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly ATTEMPT_WINDOW = 60000; // 1 minute

  constructor(
    private readonly authService: AuthService,
    private readonly samlService: SAMLService,
  ) {}

  @Get('saml/login')
  async samlLogin(@Request() req, @Res() res: Response) {
    try {
      // Check if user already has a valid JWT token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const user = await this.authService.validateToken(token);
          if (user) {
            // User is already authenticated, redirect to frontend
            const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}`;
            return res.redirect(redirectUrl);
          }
        } catch (error) {
          // Token is invalid, continue with SAML login
        }
      }

      // Rate limiting check
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      const attempts = this.loginAttempts.get(clientIp);

      if (attempts) {
        // Reset attempts if window has passed
        if (now - attempts.lastAttempt > this.ATTEMPT_WINDOW) {
          this.loginAttempts.set(clientIp, { count: 1, lastAttempt: now });
        } else if (attempts.count >= this.MAX_ATTEMPTS) {
          const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=too_many_attempts&message=${encodeURIComponent('Too many login attempts. Please try again later.')}`;
          return res.redirect(errorUrl);
        } else {
          attempts.count++;
          attempts.lastAttempt = now;
          this.loginAttempts.set(clientIp, attempts);
        }
      } else {
        this.loginAttempts.set(clientIp, { count: 1, lastAttempt: now });
      }

      // Clean up old attempts (older than 5 minutes)
      for (const [ip, attempt] of this.loginAttempts.entries()) {
        if (now - attempt.lastAttempt > 300000) { // 5 minutes
          this.loginAttempts.delete(ip);
        }
      }

      const loginUrl = await this.samlService.getLoginUrl();
      res.redirect(loginUrl);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'SAML login failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('saml/callback')
  async samlCallback(@Request() req, @Res() res: Response) {
    try {
      const result = await this.samlService.processCallback(req);
      
      if (result.success) {
        // Create JWT token
        const token = await this.authService.createJwtToken(result.user);
        
        // Redirect to frontend with token
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`;
        res.redirect(redirectUrl);
      } else {
        // Redirect to error page with error details
        const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=saml_failed&message=${encodeURIComponent(result.error || 'SAML authentication failed')}`;
        res.redirect(errorUrl);
      }
    } catch (error) {
      console.error('SAML callback error:', error);
      const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=saml_failed&message=${encodeURIComponent(error.message || 'SAML authentication failed')}`;
      res.redirect(errorUrl);
    }
  }

  @Get('saml/metadata')
  async samlMetadata(@Res() res: Response) {
    try {
      const metadata = await this.samlService.getMetadata();
      res.set('Content-Type', 'text/xml');
      res.send(metadata);
    } catch (error) {
      throw new HttpException(
        'Failed to generate SAML metadata',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@GetUser() user) {
    return this.authService.getUserById(user.id);
  }

  @Get('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req, @Res() res: Response) {
    // In a real application, you might want to blacklist the token
    res.json({ message: 'Logged out successfully' });
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refreshToken(@Request() req) {
    return this.authService.refreshToken(req.user);
  }

  @Get('user/settings')
  @UseGuards(JwtAuthGuard)
  async getUserSettings(@GetUser() user) {
    // For now, return mock settings. In a real implementation, you would fetch from database
    return {
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: true,
      },
      profile: {
        displayName: user.firstName + ' ' + user.lastName,
        email: user.email,
        avatar: null,
      },
      privacy: {
        profileVisibility: 'public',
        dataSharing: false,
      },
    };
  }

  @Put('user/settings')
  @UseGuards(JwtAuthGuard)
  async updateUserSettings(@GetUser() user, @Body() settings: any) {
    // For now, just return success. In a real implementation, you would save to database
    return {
      success: true,
      message: 'Settings updated successfully',
    };
  }

  @Post('user/settings/reset')
  @UseGuards(JwtAuthGuard)
  async resetUserSettings(@GetUser() user) {
    // For now, just return success. In a real implementation, you would reset to defaults
    return {
      success: true,
      message: 'Settings reset successfully',
    };
  }
} 