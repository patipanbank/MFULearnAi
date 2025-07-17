import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from '../models/user.model';
import { DepartmentService } from '../department/department.service';

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
    private departmentService: DepartmentService,
  ) {}

  async findOrCreateSAMLUser(profile: SAMLUserProfile): Promise<User> {
    try {
      this.logger.log(`Looking for existing user with nameID: ${profile.nameID}`);
      
      // Handle department like backendfast
      let departmentName = '';
      if (profile.department) {
        try {
          const department = await this.departmentService.ensureDepartmentExists(profile.department);
          departmentName = department.name;
          this.logger.log(`✅ Department ensured: ${departmentName}`);
        } catch (error) {
          this.logger.warn(`⚠️ Failed to ensure department: ${error.message}`);
          departmentName = profile.department.toLowerCase();
        }
      }
      
      // Try to find user by nameID first
      let user = await this.userModel.findOne({ nameID: profile.nameID }).exec();
      
      if (!user) {
        this.logger.log(`User not found by nameID, trying username: ${profile.username}`);
        // Try to find by username
        user = await this.userModel.findOne({ username: profile.username }).exec();
      }
      
      if (!user) {
        this.logger.log(`User not found, creating new user: ${profile.username}`);
        // Create new user with schema like backendfast
        const userData = {
          nameID: profile.nameID,
          username: profile.username,
          email: profile.email,
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          department: departmentName,
          groups: profile.groups || [],
          role: this.determineUserRole(profile.groups || []),
          isActive: true,
          created: new Date(),
          updated: new Date(),
        };
        
        user = new this.userModel(userData);
        await user.save();
        this.logger.log(`✅ Created new SAML user: ${user.username}`);
      } else {
        this.logger.log(`Found existing user: ${user.username}`);
        // Update existing user with latest SAML data (like backendfast)
        const updateData = {
          nameID: profile.nameID,
          email: profile.email,
          firstName: profile.firstName || user.firstName,
          lastName: profile.lastName || user.lastName,
          department: departmentName || user.department,
          groups: profile.groups || user.groups,
          role: this.determineUserRole(profile.groups || user.groups || []),
          updated: new Date(),
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

  private determineUserRole(groups: string[]): UserRole {
    // Map SAML group SIDs to user roles (like backendfast)
    // The original backendfast code has a specific group ID for students
    const isStudent = groups.some(g => g === 'S-1-5-21-893890582-1041674030-1199480097-43779');
    if (isStudent) {
      return UserRole.STUDENTS;
    }
    // Add more SID mappings as needed
    // Example: if (groups.some(g => g === 'S-1-5-21-893890582-1041674030-1199480097-513')) return UserRole.STAFFS;
    // Default role (like backendfast) - STAFFS for non-student SIDs
    return UserRole.STAFFS;
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