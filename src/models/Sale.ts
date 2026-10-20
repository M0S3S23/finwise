import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const SaleItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false },
);

const SaleSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    number: { type: Number, required: true },
    items: { type: [SaleItemSchema], validate: (v: unknown[]) => v.length > 0 },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    costTotal: { type: Number, default: 0 },
    paymentMethod: { type: String, default: 'cash' },
    customerName: { type: String, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ['completed', 'voided'], default: 'completed' },
    voidReason: { type: String, trim: true, maxlength: 300 },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
SaleSchema.index({ businessId: 1, date: -1 });
SaleSchema.index({ businessId: 1, number: 1 }, { unique: true });

export type SaleDoc = InferSchemaType<typeof SaleSchema>;
export const Sale: Model<SaleDoc> = models.Sale || model('Sale', SaleSchema);
