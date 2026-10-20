export type Product = {
  _id: string; name: string; sku?: string; category: string; unit: string;
  costPrice: number; sellingPrice: number; quantity: number; reorderLevel: number; description?: string; archived?: boolean;
};
