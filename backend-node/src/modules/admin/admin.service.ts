import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from '../users/user.schema';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
  constructor(@InjectModel('User') private readonly userModel: Model<UserDocument>) {}

  async getAllAdmins() {
    return this.userModel.find({ roles: { $in: ['Admin', 'SuperAdmin'] } }).lean();
  }

  async getAdminById(id: string) {
    const admin = await this.userModel.findById(id).lean();
    if (!admin) throw new NotFoundException('Admin not found');
    return admin;
  }

  async createAdmin(dto: CreateAdminDto) {
    const exists = await this.userModel.findOne({ username: dto.username });
    if (exists) throw new ConflictException('Username already exists');
    const user = new this.userModel({
      ...dto,
      roles: ['Admin'],
    });
    return user.save();
  }

  async updateAdmin(id: string, dto: UpdateAdminDto) {
    const updated = await this.userModel.findByIdAndUpdate(id, { $set: dto }, { new: true, lean: true });
    if (!updated) throw new NotFoundException('Admin not found');
    return updated;
  }

  async deleteAdmin(id: string) {
    const deleted = await this.userModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Admin not found');
    return deleted;
  }
} 