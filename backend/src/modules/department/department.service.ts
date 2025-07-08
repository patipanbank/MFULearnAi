import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DepartmentDocument } from './department.schema';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(@InjectModel('Department') private readonly deptModel: Model<DepartmentDocument>) {}

  async findAll() {
    return this.deptModel.find().sort({ name: 1 }).lean();
  }

  async findById(id: string) {
    const dept = await this.deptModel.findById(id).lean();
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async findByName(name: string) {
    return this.deptModel.findOne({ name: name.toLowerCase().trim() }).lean();
  }

  async create(dto: CreateDepartmentDto) {
    try {
      const created = new this.deptModel({ ...dto, name: dto.name.toLowerCase().trim() });
      return await created.save();
    } catch (err: any) {
      if (err.code === 11000) {
        throw new ConflictException('Department with this name already exists');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const updates: any = { ...dto };
    if (updates.name) {
      updates.name = updates.name.toLowerCase().trim();
    }
    const updated = await this.deptModel.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });
    if (!updated) throw new NotFoundException('Department not found');
    return updated;
  }

  async delete(id: string) {
    const deleted = await this.deptModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Department not found');
    return deleted;
  }
} 