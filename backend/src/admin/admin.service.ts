import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from '../models/user.model';
import { SystemPrompt, SystemPromptDocument } from '../models/system-prompt.model';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(SystemPrompt.name) private systemPromptModel: Model<SystemPromptDocument>,
  ) {}

  async getAllUsers(): Promise<User[]> {
    // Get only admin users (Admin and SuperAdmin roles)
    return await this.userModel.find({ 
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] }
    }).exec();
  }

  async createUser(userData: any): Promise<User> {
    // Ensure the user being created has admin role
    if (!userData.role || ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(userData.role)) {
      throw new BadRequestException('Admin users can only be created with Admin or SuperAdmin roles');
    }
    
    const user = new this.userModel(userData);
    return await user.save();
  }

  async updateUser(id: string, userData: any): Promise<User | null> {
    // Ensure the user being updated is an admin
    const existingUser = await this.userModel.findById(id);
    if (!existingUser || ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(existingUser.role)) {
      throw new BadRequestException('Can only update admin users');
    }
    
    // Ensure the updated role is also admin
    if (userData.role && ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(userData.role)) {
      throw new BadRequestException('Admin users can only have Admin or SuperAdmin roles');
    }
    
    return await this.userModel.findByIdAndUpdate(id, userData, { new: true });
  }

  async deleteUser(id: string): Promise<void> {
    // Ensure the user being deleted is an admin
    const existingUser = await this.userModel.findById(id);
    if (!existingUser || ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(existingUser.role)) {
      throw new BadRequestException('Can only delete admin users');
    }
    
    await this.userModel.findByIdAndDelete(id);
  }

  async getSystemPrompts(): Promise<SystemPrompt[]> {
    return await this.systemPromptModel.find({ isActive: true }).exec();
  }

  async createSystemPrompt(promptData: any): Promise<SystemPrompt> {
    // If this is set as default, unset other defaults
    if (promptData.isDefault) {
      await this.systemPromptModel.updateMany(
        { isDefault: true },
        { isDefault: false }
      );
    }
    
    const prompt = new this.systemPromptModel(promptData);
    return await prompt.save();
  }

  async updateSystemPrompt(id: string, promptData: any): Promise<SystemPrompt | null> {
    // If this is set as default, unset other defaults
    if (promptData.isDefault) {
      await this.systemPromptModel.updateMany(
        { _id: { $ne: id }, isDefault: true },
        { isDefault: false }
      );
    }
    
    return await this.systemPromptModel.findByIdAndUpdate(id, promptData, { new: true });
  }

  async deleteSystemPrompt(id: string): Promise<void> {
    const prompt = await this.systemPromptModel.findById(id);
    if (!prompt) {
      throw new BadRequestException('System prompt not found');
    }
    
    // Don't allow deletion of default prompt
    if (prompt.isDefault) {
      throw new BadRequestException('Cannot delete the default system prompt');
    }
    
    await this.systemPromptModel.findByIdAndDelete(id);
  }
} 