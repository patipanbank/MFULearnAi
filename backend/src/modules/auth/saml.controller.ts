import { Controller, Post, Body, Get, Request, UseGuards, Response } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
import { AuthGuard } from '@nestjs/passport';
import { SamlStrategy } from './saml.strategy';

/**
 * SAML Controller - No API Versioning
 * This controller handles SAML authentication without API versioning
 * to maintain compatibility with existing IDP configurations.
 * 
 * Routes:
 * - GET /api/auth/login/saml - Initiate SAML login
 * - GET /api/auth/logout/saml - Initiate SAML logout
 * - GET /api/auth/logout/saml/callback - Handle SAML logout callback
 * - POST/GET /api/auth/saml/callback - Handle SAML authentication callback
 * - GET /api/auth/metadata - Get SAML metadata
 */
@Controller('auth')
export class SamlController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly samlStrategy: SamlStrategy,
  ) {}

  @Get('login/saml')
  @UseGuards(AuthGuard('saml'))
  async samlLogin() {
    // Guard redirects to IdP
  }

  @Get('logout/saml')
  @UseGuards(AuthGuard('saml'))
  async samlLogout(@Request() req) {
    return this.samlStrategy.logout(req, (err, url) => url);
  }

  @Get('logout/saml/callback')
  async samlLogoutCallback() {
    // redirect to FE login page
    return { success: true };
  }

  @Post('saml/callback')
  @Get('saml/callback')
  @UseGuards(AuthGuard('saml'))
  async samlCallback(@Request() req, @Response() res) {
    try {
      // After successful SAML, Passport sets req.user -> issue JWT
      const samlUser = req.user;
      console.log('SAML callback received user:', samlUser);
      
      if (!samlUser || !samlUser.nameID) {
        console.error('SAML callback: Missing user or nameID');
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=saml_auth_failed`);
      }

      // Find or create user
      let user = await this.userService.findByUsername(samlUser.nameID);
      if (!user) {
        user = await this.userService.createUser(samlUser.nameID, samlUser.nameID);
        console.log('Created new user from SAML:', user);
      }

      // Generate JWT
      const payload = { sub: user.id, username: user.username, roles: user.roles };
      const token = await this.jwtService.signAsync(payload);
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
      
    } catch (error) {
      console.error('SAML callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/login?error=saml_callback_failed`);
    }
  }

  @Get('metadata')
  async metadata(@Response() res) {
    try {
      const strategy: any = this.samlStrategy;
      res.type('application/xml');
      res.send(strategy.generateServiceProviderMetadata(null, null));
    } catch (error) {
      console.error('Error generating SAML metadata:', error);
      res.status(500).send('Error generating metadata');
    }
  }
} 