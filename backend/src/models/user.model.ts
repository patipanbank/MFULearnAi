import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserRole {
  ADMIN = 'Admin',
  STAFFS = 'Staffs',
  STUDENTS = 'Students',
  SUPER_ADMIN = 'SuperAdmin',
}

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      if (ret.password) {
        delete ret.password;
      }
      return ret;
    },
  },
})
export class User {
  @Prop({ required: true, unique: true })
  nameID: string;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ select: false })
  password?: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop()
  firstName?: string;

  @Prop()
  lastName?: string;

  @Prop()
  department?: string;

  @Prop({ enum: UserRole, default: UserRole.STUDENTS })
  role: UserRole;

  @Prop({ type: [String], default: [] })
  groups: string[];

  @Prop({ default: Date.now })
  created: Date;

  @Prop({ default: Date.now })
  updated: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add indexes
UserSchema.index({ nameID: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ department: 1 });

// Pre-save middleware to update the updated field
UserSchema.pre('save', function(next) {
  this.updated = new Date();
  next();
});

// Pre-update middleware to update the updated field
UserSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated: new Date() });
  next();
}); 