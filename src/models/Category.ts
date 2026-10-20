import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const CategorySchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: ['income', 'expense'], required: true },
    color: { type: String, default: '#64748b' },
    /** System categories are used automatically (Sales, Inventory purchases) and cannot be deleted. */
    system: { type: String, enum: ['sales', 'inventory', null], default: null },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
CategorySchema.index({ businessId: 1, type: 1, name: 1 }, { unique: true });

export type CategoryDoc = InferSchemaType<typeof CategorySchema>;
export const Category: Model<CategoryDoc> = models.Category || model('Category', CategorySchema);
