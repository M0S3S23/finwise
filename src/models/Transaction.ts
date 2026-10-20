import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const TransactionSchema = new Schema(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 0 },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    categoryName: { type: String, default: 'Uncategorised' },
    description: { type: String, trim: true, maxlength: 300 },
    paymentMethod: { type: String, default: 'cash' },
    reference: { type: String, trim: true, maxlength: 80 },
    date: { type: Date, required: true, default: Date.now },
    /** Where the entry came from — manual entries are editable, linked ones are managed by their source. */
    source: { type: String, enum: ['manual', 'sale', 'restock'], default: 'manual' },
    saleId: { type: Schema.Types.ObjectId, ref: 'Sale' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: String,
    /** Client-generated id for offline-queued entries; makes replays idempotent. */
    clientId: { type: String },
  },
  { timestamps: true },
);
TransactionSchema.index({ businessId: 1, date: -1 });
TransactionSchema.index({ businessId: 1, type: 1, date: -1 });
TransactionSchema.index({ businessId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } });

export type TransactionDoc = InferSchemaType<typeof TransactionSchema>;
export const Transaction: Model<TransactionDoc> = models.Transaction || model('Transaction', TransactionSchema);
