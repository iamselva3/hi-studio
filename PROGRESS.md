# Hi Studio — status

Last updated: 15 Oct 2026. See RUN.md for setup, local development and deployment.

## Working and tested locally

- **Public site** (`/`): photo-led home page. Every text, photo and contact detail comes from the database, so admin edits show on the next page load.
  - Animated "Hi" splash (can be switched off in admin).
  - 3D print hero.
  - Selected work, portfolio by category, a 3D photo ring.
  - Story, process, testimonials (hidden until real ones are added), contact form.
- **Shop** (`/shop`, `/shop/:slug`, `/shop/custom-frame`):
  - Products and prices come from D1.
  - 3D frame previews.
  - Customer photos upload to the private R2 bucket (`hi-studio-uploads`); albums and diaries take many photos.
  - Order tracking needs both the order number and the phone number.
- **Checkout**:
  - Razorpay Standard Checkout. The server creates the Razorpay order and verifies the payment signature.
  - The Razorpay webhook requires a valid signature.
  - Stock is reduced exactly once when an order is paid.
- **Admin** (`/admin`):
  - Sign-in: password hashing (PBKDF2), login rate limiting, HttpOnly session cookie.
  - Dashboard with real numbers.
  - Photo library: upload, edit, hide, feature, reorder, delete.
  - Products, sizes and prices.
  - Orders: status, tracking link, customer photo download and deletion, CSV export.
  - Inquiries.
  - Website text editors.
  - Studio, delivery, GST and shop settings.
  - Works on phones.
- **Storage**: Hi Studio has its own buckets (`hi-studio-media`, `hi-studio-uploads`) in the Cloudflare account. Nothing uses the Imagix bucket.

## Still to do before going live

1. **Production database.** Create the D1 database and put its id in `wrangler.toml` (see RUN.md). The current Cloudflare API token can manage R2 but not D1: either give it D1 edit permission or use `npx wrangler login`.
2. **Real Razorpay keys.** Razorpay rejects the keys in `.dev.vars`. Add real test keys to try a payment end to end, then live keys as Pages secrets, and set up the webhook.
3. **Secrets.** In production set `JWT_SECRET` and `ADMIN_PASSWORD_HASH` (`npm run hash-password`). Don't use the short local password.
4. **Real content.** Check and replace the placeholder details in admin:
   - address, email, Instagram, GSTIN, legal company name
   - years, weddings and awards figures
   - real client testimonials
5. **Content to review.**
   - The policy pages are plain-language drafts and need the owner's review.
   - The product photos in `public/media/products/` are stock images and should be replaced with photos of the real products.
   - Most portfolio photos are small (about 500–750 px wide). Higher-resolution originals will look much better.
6. **Housekeeping.**
   - Product images removed in admin are not yet deleted from R2.
   - Customer uploads that never become an order are not cleaned up automatically.
