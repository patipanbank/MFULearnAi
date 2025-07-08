import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshTokenDocument } from './refresh-token.schema';
import { randomBytes } from 'crypto';

@Injectable()
export class RefreshTokenService {
  private ttlDays = 7;

  constructor(@InjectModel('RefreshToken') private readonly model: Model<RefreshTokenDocument>) {}

  async create(userId: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000);
    await this.model.create({ userId, token, expiresAt });
    return token;
  }

  async verify(token: string) {
    const doc = await this.model.findOne({ token });
    if (!doc) return null;
    if (doc.expiresAt < new Date()) {
      await doc.deleteOne();
      return null;
    }
    return doc.userId;
  }

  async rotate(oldToken: string) {
    const userId = await this.verify(oldToken);
    if (!userId) return null;
    await this.model.deleteOne({ token: oldToken });
    const newToken = await this.create(userId);
    return { userId, token: newToken };
  }
} 