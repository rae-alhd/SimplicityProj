const { z } = require("zod");

const productSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().nullable().optional(),
  category: z.string().min(1, "category is required"),
  target_group: z.string().min(1, "target_group is required"),
  base_price: z.coerce.number().positive("base_price must be greater than 0"),
  stock_quantity: z.coerce.number().int().min(0).optional(),
  image_url: z
    .string()
    .url("image_url must be a valid URL")
    .nullable()
    .optional()
    .or(z.literal("")),
  is_customizable: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

module.exports = { productSchema };