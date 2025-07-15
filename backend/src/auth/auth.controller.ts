import { Controller, Post, Get, Body, Req, Res, HttpStatus, HttpCode, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfigService } from '../config/config.service';
import { SamlService } from './saml.service';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

// Removed basic login/register DTOs - not needed for SAML-only authentication

export class AdminLoginDto {
  username: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private samlService: SamlService,
  ) {}

  // Removed basic login/register endpoints - SAML-only authentication system

  @UseGuards(AuthGuard('jwt'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('User not authenticated');
    }
    
    // Generate new JWT token with extended expiration (7 days like FastAPI)
    const newToken = await this.authService.refreshToken(req.user.id);
    
    return { token: newToken };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfile(@Req() req: any) {
    // This matches FastAPI's /me route
    return {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
      department: req.user.department,
    };
  }

  // Change from POST to GET to match FastAPI
  @Get('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res() res: Response) {
    // Simple logout - just redirect to login page (matches FastAPI)
    console.log('Simple logout requested');
    const frontendUrl = this.configService.frontendUrl || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/login?logged_out=true`);
  }

  // ==============================================
  // SAML Authentication Routes - เหมือนกับ FastAPI
  // ==============================================

  // Route 1: /api/auth/login/saml - เริ่มต้น SAML login
  @Get('login/saml')
  async loginSaml(@Req() req: Request, @Res() res: Response) {
    try {
      const relayState = req.query.RelayState as string;
      const samlLoginUrl = await this.samlService.getLoginUrl(relayState);
      
      console.log('Generated SAML Login URL:', samlLoginUrl);
      return res.redirect(samlLoginUrl);
    } catch (error) {
      console.error('SAML Login Error:', error);
      return res.status(500).json({ 
        error: 'SAML login failed', 
        details: error.message 
      });
    }
  }

  // Route 2: /api/auth/saml/callback - จัดการ SAML Response
  @Post('saml/callback')
  @Get('saml/callback')
  async samlCallback(@Req() req: Request, @Res() res: Response) {
    try {
      console.log('SAML Callback received:', req.method, req.url);
      console.log('Request body:', req.body);
      console.log('Request query:', req.query);
      
      // ประมวลผล SAML response
      const samlUser = await this.samlService.validatePostResponse(req.body);
      console.log('SAML User:', samlUser);
      
      // แปลง SAML user เป็น profile
      const profile = this.samlService.extractUserProfile(samlUser);
      console.log('Extracted Profile:', profile);
      
      // CRITICAL: ต้องรองรับ attribute "User.Userrname" (typo ที่มีอยู่ใน IdP)
      // ห้ามเปลี่ยนแปลง typo นี้เพราะ IdP มีอยู่แล้ว
      if (!profile.username) {
        throw new Error('Username not found in SAML attributes');
      }
      
      // สร้างหรืออัปเดต user ในฐานข้อมูล
      const user = await this.authService.findOrCreateUserFromSaml(profile);
      console.log('User found/created:', user);
      
      // สร้าง JWT token
      const token = await this.authService.createTokenFromUser(user);
      console.log('JWT Token created');
      
      // Update last login
      await this.authService.updateUserLastLogin(user.id);
      
      // Redirect กลับไป frontend พร้อม token
      const redirectUrl = `${this.configService.frontendUrl}/auth/callback?saml=success&token=${encodeURIComponent(token)}&username=${encodeURIComponent(profile.username)}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('SAML Callback Error:', error);
      
      const errorUrl = `${this.configService.frontendUrl}/login?error=saml_auth_failed&details=${encodeURIComponent(error.message)}`;
      return res.redirect(errorUrl);
    }
  }

  // Route 3: /api/auth/logout/saml - เริ่มต้น SAML logout
  @Get('logout/saml')
  async logoutSaml(@Req() req: Request, @Res() res: Response) {
    try {
      const nameId = req.query.name_id as string || 'mock_user_id';
      const sessionIndex = req.query.session_index as string || 'mock_session_index';
      const relayState = req.query.RelayState as string;
      
      const samlLogoutUrl = await this.samlService.getLogoutUrl(nameId, sessionIndex, relayState);
      
      console.log('Generated SAML Logout URL:', samlLogoutUrl);
      return res.redirect(samlLogoutUrl);
    } catch (error) {
      console.error('SAML Logout Error:', error);
      return res.status(500).json({ 
        error: 'SAML logout failed',
        details: error.message 
      });
    }
  }

  // Route 4: /api/auth/logout/saml/callback - จัดการ SAML Logout Response
  @Post('logout/saml/callback')
  @Get('logout/saml/callback')
  async samlLogoutCallback(@Req() req: Request, @Res() res: Response) {
    try {
      console.log('SAML Logout Callback received:', req.method, req.url);
      
      // ประมวลผล SAML logout response
      const loggedOut = await this.samlService.validateLogoutResponse(req.body);
      console.log('SAML Logout Result:', loggedOut);
      
      // Redirect กลับไป frontend
      const redirectUrl = `${this.configService.frontendUrl}/login?saml_logged_out=true`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('SAML Logout Callback Error:', error);
      
      const errorUrl = `${this.configService.frontendUrl}/login?error=saml_logout_failed&details=${encodeURIComponent(error.message)}`;
      return res.redirect(errorUrl);
    }
  }

  // Route 5: /api/auth/logout/saml/manual - Manual logout (ไม่ผ่าน IdP)
  @Get('logout/saml/manual')
  async manualLogout(@Req() req: Request, @Res() res: Response) {
    try {
      console.log('Manual SAML logout:', req.url);
      
      // Redirect กลับไป frontend (เหมือนกับ FastAPI)
      const redirectUrl = `${this.configService.frontendUrl}/login?saml_logged_out=true&manual=true`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Manual Logout Error:', error);
      return res.status(500).json({ 
        error: 'Manual logout failed',
        details: error.message 
      });
    }
  }

  // Route 6: /api/auth/metadata - Service Provider Metadata
  @Get('metadata')
  async getMetadata(@Res() res: Response) {
    try {
      const metadata = await this.samlService.getMetadata();
      
      res.set('Content-Type', 'application/xml');
      return res.send(metadata);
    } catch (error) {
      console.error('Metadata Error:', error);
      return res.status(500).json({ 
        error: 'Failed to generate metadata',
        details: error.message 
      });
    }
  }

  // ==============================================
  // Admin Login Route - เหมือนกับ FastAPI
  // ==============================================

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() adminLoginDto: AdminLoginDto) {
    try {
      const { username, password } = adminLoginDto;
      
      // Use AuthService for admin login (เหมือน FastAPI)
      const result = await this.authService.adminLogin(username, password);
      
      return {
        token: result.token,
        user: result.user
      };
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
} 