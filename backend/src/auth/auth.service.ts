import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../models/user.model';
import { ConfigService } from '../config/config.service';
import { UserService, SAMLUserProfile } from './user.service';
import * as bcrypt from 'bcryptjs';

export interface JwtPayload {
  sub: string;
  nameID: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  department?: string;
  groups?: string[];
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private userService: UserService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({ username }).select('+password');
    if (user && user.password && await this.comparePasswords(password, user.password)) {
      const { password, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      nameID: user.nameID,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department,
      groups: user.groups,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nameID: user.nameID,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        groups: user.groups,
      },
    };
  }

  async createJwtToken(user: any): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      nameID: user.nameID,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      department: user.department,
      groups: user.groups,
    };

    return this.jwtService.sign(payload);
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.userModel.findById(userId).exec();
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async getUserByNameID(nameID: string): Promise<User | null> {
    return this.userModel.findOne({ nameID }).exec();
  }

  async createUser(userData: Partial<User>): Promise<User> {
    // Hash password if present
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }
    const user = new this.userModel(userData);
    return user.save();
  }

  async findOrCreateSAMLUser(profile: SAMLUserProfile): Promise<User> {
    return this.userService.findOrCreateSAMLUser(profile);
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User | null> {
    // Hash password if present
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    return this.userModel.findByIdAndUpdate(userId, updateData, { new: true }).exec();
  }

  async refreshToken(user: any) {
    return this.login(user);
  }

  private async comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
} 