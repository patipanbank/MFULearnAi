import { Controller, Post, Body, Get, Request, UseGuards, Response, Version } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
import { JwtAuthGuard } from './jwt.guard';
import * as bcrypt from 'bcryptjs';
import { AuthGuard } from '@nestjs/passport';
import { RefreshTokenService } from './refresh-token.service';
import { SamlStrategy } from './saml.strategy';
import { ZodValidation } from '../../common/decorators/zod-validation.decorator';
import { 
  loginSchema, 
  refreshTokenSchema, 
  LoginDto, 
  RefreshTokenDto 
} from '../../common/schemas';

@Controller({
  path: 'auth',
  version: '1'
})
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly refreshService: RefreshTokenService,
    private readonly samlStrategy: SamlStrategy,
  ) {}

  @Post('login')
  @ZodValidation(loginSchema)
  async login(@Body() body: LoginDto) {
    const { username, password } = body;
    const user = await this.userService.findByUsername(username);
    if (!user) {
      return { error: 'Invalid credentials' };
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return { error: 'Invalid credentials' };
    }

    const payload = { sub: user.id, username: user.username, roles: user.roles };
    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '15m' });
    const refreshToken = await this.refreshService.create(user.id);
    return { accessToken, refreshToken, user };
  }

  @Post('refresh')
  @ZodValidation(refreshTokenSchema)
  async refreshToken(@Body() body: RefreshTokenDto) {
    const { refreshToken: token } = body;
    const result = await this.refreshService.rotate(token);
    if (!result) return { error: 'Invalid refresh' };
    const payload = { sub: result.userId };
    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '15m' });
    return { accessToken, refreshToken: result.token };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout() {
    // JWT logout is managed client-side by discarding token
    return { success: true };
  }

  // ---------- SAML FLOW ----------
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
  async samlCallback(@Request() req) {
    // After successful SAML, Passport sets req.user -> issue JWT
    const samlUser = req.user;
    const user = await this.userService.findByUsername(samlUser.nameID) || await this.userService.createUser(samlUser.nameID, samlUser.nameID);
    const payload = { sub: user.id, username: user.username, roles: user.roles };
    const token = await this.jwtService.signAsync(payload);
    return { token, user };
  }

  @Get('metadata')
  async metadata(@Response() res) {
    const strategy: any = this.samlStrategy;
    res.type('application/xml');
    res.send(strategy.generateServiceProviderMetadata(null, null));
  }
} 