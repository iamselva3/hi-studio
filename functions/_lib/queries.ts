import type { Env, OrderRow, PhotoRow, Product, ProductRow, VariantRow } from './types';
import { assembleProducts, toOrder, toPhoto } from './mappers';
import { notFound } from './http';

/** Statements for products + variants; `all` includes inactive ones (admin). */
export function productStatements(env: Env, all: boolean): [D1PreparedStatement, D1PreparedStatement] {
  return all
    ? [
        env.DB.prepare('SELECT * FROM products ORDER BY sort_order ASC, name ASC'),
        env.DB.prepare('SELECT * FROM variants ORDER BY rowid ASC'),
      ]
    : [
        env.DB.prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort_order ASC, name ASC'),
        env.DB.prepare(
          `SELECT v.* FROM variants v JOIN products p ON p.id = v.product_id
           WHERE v.active = 1 AND p.active = 1 ORDER BY v.rowid ASC`
        ),
      ];
}

/** Public catalogue: active products with their active variants (products with none are left out). */
export function publicProducts(products: ProductRow[], variants: VariantRow[]): Product[] {
  return assembleProducts(products, variants, true);
}

export async function loadAllProducts(env: Env): Promise<Product[]> {
  const [products, variants] = await env.DB.batch(productStatements(env, true));
  return assembleProducts(products.results as ProductRow[], variants.results as VariantRow[], false);
}

export async function loadProduct(env: Env, id: string): Promise<Product> {
  const [products, variants] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id),
    env.DB.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY rowid ASC').bind(id),
  ]);
  const product = assembleProducts(products.results as ProductRow[], variants.results as VariantRow[], false)[0];
  if (!product) throw notFound('Product not found');
  return product;
}

export async function loadPhoto(env: Env, id: string) {
  const row = await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first<PhotoRow>();
  if (!row) throw notFound('Photo not found');
  return toPhoto(row);
}

/** Admin view of one order, including download links for its customer photos still in storage. */
export async function loadAdminOrder(env: Env, id: string) {
  const [orderRes, uploadsRes] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id),
    env.DB.prepare('SELECT r2_key FROM customer_uploads WHERE order_id = ? AND deleted_at IS NULL').bind(id),
  ]);
  const row = (orderRes.results as OrderRow[])[0];
  if (!row) throw notFound('Order not found');
  return toOrder(row, new Set((uploadsRes.results as { r2_key: string }[]).map((u) => u.r2_key)));
}
