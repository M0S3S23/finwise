import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const UserSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 160 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['owner', 'staff'], default: 'staff', required: true },
    active: { type: Boolean, default: true },
    mustChangePassword: { type: Boolean, default: false },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export const User: Model<UserDoc> = models.User || model('User', UserSchema);
