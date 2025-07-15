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
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { SAMLService } from './saml.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { GetUser } from './decorators/get-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly samlService: SAMLService,
  ) {}

  @Get('saml/login')
  async samlLogin(@Request() req, @Res() res: Response) {
    try {
      const loginUrl = await this.samlService.getLoginUrl();
      res.redirect(loginUrl);
    } catch (error) {
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
        throw new HttpException(
          'SAML authentication failed',
          HttpStatus.UNAUTHORIZED,
        );
      }
    } catch (error) {
      console.error('SAML callback error:', error);
      const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error`;
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
} 