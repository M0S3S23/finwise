import { Schema, model, models, type InferSchemaType, type Model } from 'mongoose';

const BusinessSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    currency: { type: String, required: true, default: 'USD', uppercase: true },
    industry: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 300 },
    taxNumber: { type: String, trim: true, maxlength: 60 },
    receiptFooter: { type: String, trim: true, maxlength: 300 },
    defaultReorderLevel: { type: Number, default: 5, min: 0 },
    saleSeq: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type BusinessDoc = InferSchemaType<typeof BusinessSchema> & { _id: Schema.Types.ObjectId };
export const Business: Model<InferSchemaType<typeof BusinessSchema>> = models.Business || model('Business', BusinessSchema);
