import { z } from "zod";

/** A measurement in millimetres; `min === max` unless the source gives a range ("150 - 180"). */
export const RangeSchema = z.object({ min: z.number(), max: z.number() });

export const SpecSchema = z.object({
  group: z.string(),
  name: z.string(),
  values: z.array(z.string()),
});

export const VariantSchema = z.object({
  code: z.string(),
  barcode: z.string().nullable(),
  /** Attribute name → selected value, e.g. { "Üst Kapak": "Şeffaf Kapak" }. */
  options: z.record(z.string(), z.string()),
});

export const DocumentSchema = z.object({
  /**
   * drawing = dimensioned PDF drawing, machining-template = CNC cut-out template,
   * print-template = artwork template for UV printing.
   */
  type: z.enum([
    "drawing",
    "dxf",
    "step",
    "ip-certificate",
    "machining-template",
    "print-template",
    "other",
  ]),
  name: z.string(),
  url: z.url(),
});

export const CategorySchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  parentId: z.number().int().nullable(),
});

export const EnclosureSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  slug: z.string(),
  name: z.object({ tr: z.string(), en: z.string().nullable() }),
  url: z.object({ tr: z.url(), en: z.url() }),
  categoryId: z.number().int(),
  /** Outer dimensions A × B × C in mm, as listed by Altınkaya. */
  outer: z.object({ a: RangeSchema, b: RangeSchema, c: RangeSchema }).nullable(),
  /** Detailed drawing dimensions (E1, B2, D3, P1, …) in mm; meaning varies by family. */
  drawing: z.record(z.string(), z.number()),
  materials: z.array(z.string()),
  ipRating: z.string().nullable(),
  operatingTemperature: RangeSchema.nullable(),
  /** Every specification row as published, for anything not normalized above. */
  specs: z.array(SpecSchema),
  variants: z.array(VariantSchema),
  documents: z.array(DocumentSchema),
  images: z.array(z.url()),
});

export const CatalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime(),
  source: z.literal("https://www.altinkaya.com"),
  categories: z.array(CategorySchema),
  enclosures: z.array(EnclosureSchema),
});

export type Range = z.infer<typeof RangeSchema>;
export type Spec = z.infer<typeof SpecSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Enclosure = z.infer<typeof EnclosureSchema>;
export type Catalog = z.infer<typeof CatalogSchema>;
