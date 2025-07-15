import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../models/user.model';
import { ConfigService } from '../config/config.service';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  username: string;
  email: string;
  password: string;
  nameID: string;
  role?: UserRole;
  department?: string;
  firstName?: string;
  lastName?: string;
}

export interface JwtPayload {
  sub: string;        // user ID (เหมือน FastAPI)
  nameID?: string;    // SAML nameID
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  groups?: string[];
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    try {
      const user = await this.userModel.findOne({ email }).select('+password');
      if (!user) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password || '');
      if (!isPasswordValid) {
        return null;
      }

      // Remove password from returned user object
      const { password: _, ...result } = user.toObject();
      return result;
    } catch (error) {
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const user = await this.validateUser(loginDto.email, loginDto.password);
      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const payload: JwtPayload = {
        sub: user._id.toString(),
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        groups: user.groups || [],
        role: user.role,
      };

      const accessToken = this.jwtService.sign(payload);

      return {
        accessToken,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          department: user.department,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Login failed');
    }
  }

  async register(registerDto: RegisterDto) {
    try {
      // Check if user already exists
      const existingUser = await this.userModel.findOne({
        $or: [{ email: registerDto.email }, { username: registerDto.username }],
      });

      if (existingUser) {
        throw new BadRequestException('User with this email or username already exists');
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(registerDto.password, saltRounds);

      // Create new user
      const newUser = new this.userModel({
        nameID: registerDto.nameID,
        username: registerDto.username,
        email: registerDto.email,
        password: hashedPassword,
        role: registerDto.role || UserRole.STUDENTS,
        department: registerDto.department,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      });

      const savedUser = await newUser.save();

      // Generate JWT token
      const payload: JwtPayload = {
        sub: savedUser._id.toString(),
        nameID: savedUser.nameID,
        username: savedUser.username,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        department: savedUser.department,
        groups: savedUser.groups || [],
        role: savedUser.role,
      };

      const accessToken = this.jwtService.sign(payload);

      return {
        accessToken,
        user: {
          id: savedUser._id,
          username: savedUser.username,
          email: savedUser.email,
          role: savedUser.role,
          department: savedUser.department,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Registration failed');
    }
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(userId: string): Promise<string> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const payload: JwtPayload = {
        sub: user._id.toString(),
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        groups: user.groups || [],
        role: user.role,
      };

      return this.jwtService.sign(payload, { expiresIn: '7d' }); // 7 days like FastAPI
    } catch (error) {
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  async getUserById(id: string): Promise<User> {
    try {
      const user = await this.userModel.findById(id);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return user;
    } catch (error) {
      throw new UnauthorizedException('User not found');
    }
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        updated: new Date(),
      });
    } catch (error) {
      // Log error but don't throw - this is not critical
      console.error('Failed to update last login:', error);
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await this.userModel.findById(userId).select('+password');
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password || '');
      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      const saltRounds = 10;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      await this.userModel.findByIdAndUpdate(userId, {
        password: hashedNewPassword,
        updated: new Date(),
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Password change failed');
    }
  }

  async deactivateUser(userId: string): Promise<void> {
    try {
      await this.userModel.findByIdAndUpdate(userId, {
        updated: new Date(),
      });
    } catch (error) {
      throw new BadRequestException('User deactivation failed');
    }
  }

  async adminLogin(username: string, password: string) {
    try {
      // Find admin user by username
      const user = await this.userModel.findOne({ 
        username: username,
        role: { $in: ['Admin', 'SuperAdmin'] }
      }).select('+password');
      
      if (!user || !user.password) {
        throw new UnauthorizedException('Admin account not found or password not set');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Password is incorrect');
      }

      // Create token payload matching FastAPI structure
      const tokenPayload: JwtPayload = {
        sub: user._id.toString(),
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department || 'admin',
        groups: user.groups || [],
        role: user.role,
      };

      // Generate JWT token with 1 day expiration (like FastAPI)
      const token = this.jwtService.sign(tokenPayload, { expiresIn: '24h' });

      // Update last login
      await this.updateUserLastLogin(user._id.toString());

      return {
        token: token,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          department: user.department,
          firstName: user.firstName,
          lastName: user.lastName,
        }
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Admin login failed');
    }
  }

  async findAdminByUsername(username: string): Promise<User | null> {
    try {
      return await this.userModel.findOne({ 
        username: username,
        role: { $in: ['Admin', 'SuperAdmin'] }
      }).select('+password');
    } catch (error) {
      return null;
    }
  }

  async verifyAdminPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      return false;
    }
  }

  // SAML User Management Methods
  async findOrCreateUserFromSaml(profile: any): Promise<any> {
    try {
      // Find existing user by nameID or username
      let user = await this.userModel.findOne({
        $or: [
          { nameID: profile.nameID },
          { username: profile.username },
          { email: profile.email }
        ]
      });

      if (user) {
        // Update existing user with latest SAML data
        const updateData: any = {
          updated: new Date(),
          email: profile.email || user.email,
          firstName: profile.firstName || user.firstName,
          lastName: profile.lastName || user.lastName,
          department: profile.department || user.department,
          groups: profile.groups || user.groups || [],
        };

        // Update nameID if not set
        if (!user.nameID && profile.nameID) {
          updateData.nameID = profile.nameID;
        }

        // Update username if not set
        if (!user.username && profile.username) {
          updateData.username = profile.username;
        }

        const updatedUser = await this.userModel.findByIdAndUpdate(
          user._id,
          updateData,
          { new: true }
        );
        
        if (!updatedUser) {
          throw new BadRequestException('Failed to update user');
        }
        
        user = updatedUser;
      } else {
        // Create new user from SAML profile
        const newUser = new this.userModel({
          nameID: profile.nameID,
          username: profile.username,
          email: profile.email,
          firstName: profile.firstName,
          lastName: profile.lastName,
          department: profile.department,
          groups: profile.groups || [],
          role: this.determineUserRole(profile.groups), // Determine role from groups
          created: new Date(),
          updated: new Date(),
        });

        user = await newUser.save();
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user.toObject();
      return {
        ...userWithoutPassword,
        id: userWithoutPassword._id.toString()
      };
    } catch (error) {
      console.error('Error finding/creating user from SAML:', error);
      throw new BadRequestException('Failed to process SAML user');
    }
  }

  async createTokenFromUser(user: any): Promise<string> {
    try {
      const payload: JwtPayload = {
        sub: user.id || user._id.toString(),
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department,
        groups: user.groups || [],
        role: user.role,
      };

      return this.jwtService.sign(payload, { expiresIn: '24h' });
    } catch (error) {
      console.error('Error creating token from user:', error);
      throw new UnauthorizedException('Failed to create authentication token');
    }
  }

  private determineUserRole(groups: string[]): UserRole {
    if (!groups || groups.length === 0) {
      return UserRole.STUDENTS;
    }

    const groupNames = groups.map(g => g.toLowerCase());
    
    // Check for admin roles first
    if (groupNames.some(g => g.includes('admin') || g.includes('super'))) {
      return UserRole.SUPER_ADMIN;
    }
    
    if (groupNames.some(g => g.includes('staff') || g.includes('faculty'))) {
      return UserRole.STAFFS;
    }
    
    // Default to students
    return UserRole.STUDENTS;
  }
} 