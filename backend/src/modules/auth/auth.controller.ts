import { Controller, Post, Body, Get, Request, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service';
import { JwtAuthGuard } from './jwt.guard';
import { RefreshTokenService } from './refresh-token.service';
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

  // SAML endpoints moved to separate SamlController (no versioning)
} 