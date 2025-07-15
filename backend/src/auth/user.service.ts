import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../models/user.model';

export interface SAMLUserProfile {
  nameID: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  groups?: string[];
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findOrCreateSAMLUser(profile: SAMLUserProfile): Promise<User> {
    try {
      this.logger.log(`Looking for existing user with nameID: ${profile.nameID}`);
      
      // Try to find user by nameID first
      let user = await this.userModel.findOne({ nameID: profile.nameID }).exec();
      
      if (!user) {
        this.logger.log(`User not found by nameID, trying username: ${profile.username}`);
        // Try to find by username
        user = await this.userModel.findOne({ username: profile.username }).exec();
      }
      
      if (!user) {
        this.logger.log(`User not found, creating new user: ${profile.username}`);
        // Create new user
        const userData = {
          nameID: profile.nameID,
          username: profile.username,
          email: profile.email,
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          department: profile.department || '',
          groups: profile.groups || [],
          role: this.determineUserRole(profile.groups || []),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        user = new this.userModel(userData);
        await user.save();
        this.logger.log(`✅ Created new SAML user: ${user.username}`);
      } else {
        this.logger.log(`Found existing user: ${user.username}`);
        // Update existing user with latest SAML data
        const updateData = {
          nameID: profile.nameID,
          email: profile.email,
          firstName: profile.firstName || user.firstName,
          lastName: profile.lastName || user.lastName,
          department: profile.department || user.department,
          groups: profile.groups || user.groups,
          role: this.determineUserRole(profile.groups || user.groups || []),
          updatedAt: new Date(),
        };
        
        const updatedUser = await this.userModel.findByIdAndUpdate(
          user.id,
          updateData,
          { new: true }
        ).exec();
        
        if (!updatedUser) {
          throw new Error('Failed to update user');
        }
        
        user = updatedUser;
        this.logger.log(`✅ Updated existing SAML user: ${user.username}`);
      }
      
      return user;
    } catch (error) {
      this.logger.error(`Error in findOrCreateSAMLUser: ${error.message}`);
      throw error;
    }
  }

  private determineUserRole(groups: string[]): string {
    // Map SAML groups to user roles
    if (groups.includes('Students')) {
      return 'STUDENTS';
    } else if (groups.includes('Staffs')) {
      return 'STAFFS';
    } else if (groups.includes('Admin')) {
      return 'ADMIN';
    } else if (groups.includes('Super Admin')) {
      return 'SUPER_ADMIN';
    }
    
    // Default role
    return 'STUDENTS';
  }

  async findUserByNameID(nameID: string): Promise<User | null> {
    return this.userModel.findOne({ nameID }).exec();
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }
} 