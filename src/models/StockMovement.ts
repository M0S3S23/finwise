import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const StockMovementSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    type: { type: String, enum: ['initial', 'restock', 'sale', 'adjustment', 'void'], required: true },
    /** Signed: positive adds stock, negative removes it. */
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number },
    unitCost: { type: Number, default: 0 },
    note: { type: String, trim: true, maxlength: 300 },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
StockMovementSchema.index({ businessId: 1, productId: 1, date: -1 });

export type StockMovementDoc = InferSchemaType<typeof StockMovementSchema>;
export const StockMovement: Model<StockMovementDoc> = models.StockMovement || model('StockMovement', StockMovementSchema);
