import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument } from './user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel('User') private readonly userModel: Model<UserDocument>) {}

  async findByUsername(username: string) {
    return this.userModel.findOne({ username });
  }

  async createUser(username: string, password: string, roles: string[] = ['STUDENT'], department?: string) {
    const user = new this.userModel({ username, password, roles, department });
    await user.save();
    return user;
  }
} 