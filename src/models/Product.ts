import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const ProductSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sku: { type: String, trim: true, maxlength: 60 },
    category: { type: String, trim: true, maxlength: 60, default: 'General' },
    unit: { type: String, trim: true, maxlength: 20, default: 'pcs' },
    costPrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 5, min: 0 },
    description: { type: String, trim: true, maxlength: 500 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
ProductSchema.index({ businessId: 1, archived: 1, name: 1 });
ProductSchema.index({ businessId: 1, sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: 'string', $gt: '' } } });

export type ProductDoc = InferSchemaType<typeof ProductSchema>;
export const Product: Model<ProductDoc> = models.Product || model('Product', ProductSchema);
