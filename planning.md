Collecting workspace informationGitHub Copilot

Summary (backend changes needed)
- Make item/category names canonical + translatable: keep stable IDs/slugs and return a translations object for UI. Provide backward-compatible behavior when name is still a string.
- Add/ensure slug field and auto-generate it when missing.
- Expose API variant: full translations object (preferred) and optional ?lang= that returns localized strings for quick clients.
- Keep server-side translation utilities centralized in `TranslationService`.
- Provide a DB migration script to convert existing string names -> { en: oldName } and create slugs.
- Update main endpoints that return items/categories/orders/cart so they include both canonical fields and translations object.
- Ensure server-sent payloads (sockets, notifications) use _id/slug as canonical keys and include translation keys/objects for client rendering.

Concrete backend tasks (ordered, with workspace references)

1) Model changes (allow translation object, ensure slug)
- Update item.ts to accept name as either string or object, and add pre-save middleware that:
  - converts string name -> { en: name }
  - creates slug if missing
- Do the same for Category model (file referenced/used in controllers: see `src/controllers/categoryController.ts`).

References: `itemSchema`, `generateSlug` helper usage in categoryController.

Patch example (minimal, compatible):
```typescript
// ...existing code...
import slugify from "slugify";
// ...existing code...
export const itemSchema = new Schema<IItem>({
  // allow string or object for backward compatibility
  name: { type: Schema.Types.Mixed, required: true },
  slug: { type: String, required: false },
  points: { type: Number, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  measurement_unit: { type: Number, enum: [1, 2], required: true },
  image: { type: String, required: true },
  categoryName: { type: String },
});
// ...existing code...
itemSchema.pre('save', function(this: any, next) {
  // Convert string name -> { en: string }
  if (this.name && typeof this.name === 'string') {
    this.name = { en: this.name };
  }
  // Ensure slug
  if (!this.slug && this.name) {
    const source = typeof this.name === 'string' ? this.name : (this.name.en || Object.values(this.name)[0] || this._id);
    this.slug = slugify(String(source), { lower: true, strict: true });
  }
  next();
});
// ...existing code...
```

2) API contract: return both canonical and translations
- Update endpoints that return items/categories/orders/cart to include:
  - _id, slug, name: { en?, ar? } OR if old format, convert to { en } on the fly
  - categoryId/categorySlug
- Endpoints to update:
  - itemsController.ts — getAllItems, getItems, getItemById, getItemByName/Slug
  - categoryController.ts — category list and getCategoryByName
  - cartControllers.ts — cart endpoints returning item shape
  - pickupController.ts — order item shapes (aggregation outputs)
  - deliveryController.ts and courierController.ts if they return item names

Reference symbol: `TranslationService.getTranslations` — use it for server-side localization when ?lang= provided.

Example mapping inside items controller (return canonical + name object):
```typescript
// ...existing code...
// after retrieving `items` from DB, normalize name shape:
items = items.map(i => {
  const nameObj = typeof i.name === 'string' ? { en: i.name } : (i.name || {});
  return {
    ...i,
    name: nameObj,
    slug: i.slug || (nameObj.en ? nameObj.en.replace(/\s+/g,'-').toLowerCase() : i._id),
    categoryId: i.categoryId || i.categoryId
  };
});
// ...existing code...
```

3) Add optional ?lang= query support (fast localized responses)
- Implement pattern: if req.query.lang present (en|ar), server returns localized string fields alongside/alternatively to full translation object.
- Use `TranslationService.getTranslations` to map keys -> localized strings when needed.

Example usage:
- In itemsController.ts and pickupController.ts use:
  - const translations = await TranslationService.getTranslations(language);
  - map item.name -> translations[TranslationService.generateKey(`${categoryName}_${itemName}`, 'item')] fallback.

4) Ensure server uses canonical IDs/slugs in messages/events
- Review socket emissions and notifications to include _id/slug not display name:
  - realtime.ts
  - Controllers using sockets: pickupController.ts, courierController.ts
- Update real-time payloads: include item._id and item.slug.

5) Translation infrastructure improvements
- Use existing translation.ts and translationService.ts.
- Make sure `TranslationService.generateKey` and `getTranslations` are used to power both:
  - server-side ?lang= lookups
  - migration/seed scripts
- Add helper transform: when creating category/item translations, populate translation.referenceId with category/item id.

6) DB migration & compatibility
- Add migration script (node script) to convert existing name strings -> { en } and create slugs for categories & items.
- Place script as e.g. `scripts/migrate-add-translations.js` and run once.

Migration script example:
```js
// ...existing code...
const { MongoClient } = require('mongodb');
const slugify = require('slugify');

async function migrate() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();
  const categories = db.collection('categories');
  const cursor = categories.find({});
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const updates = {};
    if (doc.name && typeof doc.name === 'string') updates.name = { en: doc.name };
    if (!doc.slug && doc.name) updates.slug = slugify(doc.name, { lower: true, strict: true });
    if (Object.keys(updates).length) {
      await categories.updateOne({ _id: doc._id }, { $set: updates });
      console.log('Updated category', doc._id);
    }
  }
  // repeat similarly for items subdocs if stored in categories
  await client.close();
}
migrate().catch(console.error);
```

7) Backwards compatibility helpers
- Create small helper on server side so older clients keep working:
  - When reading a resource, if name is string convert to { en: name } (we showed this above).
  - In responses include both: name (object) and localizedName when ?lang is present.

8) Tests & verification (backend)
- Add unit tests to assert:
  - model pre-save converts string->object and creates slug
  - endpoints return expected shape (canonical fields + translations)
  - translation lookups via `TranslationService.getTranslations` work for both languages
- End-to-end sanity: cart flow (cart uses _id/slug), order create and notifications use canonical keys.

Files & symbols to edit (links)
- Models:
  - item.ts — `itemSchema` (pre-save)
  - translation.ts
  - pickupOrder.ts — ensure order items include slug/_id
- Services:
  - `TranslationService` — `TranslationService.getTranslations`, `TranslationService.generateKey`
- Controllers:
  - itemsController.ts
  - categoryController.ts
  - cartControllers.ts
  - pickupController.ts
  - courierController.ts
- Sockets:
  - realtime.ts
  - socketServer.ts
- Utils:
  - stockHelper.ts — ensure it uses category/items by id and keeps slug unaffected
- Migration script:
  - scripts/migrate-add-translations.js (new file)

Progress (backend) — updates applied in this branch:

- Models:
  - `src/models/item.ts` updated: `name` accepts mixed type, pre-save converts legacy string -> `{ en }`, generates `slug` using `slugify`.
  - `src/models/category.ts` updated: `name` accepts mixed type, pre-save converts and generates `slug`.

- Controllers & services:
  - `src/controllers/itemsController.ts` normalized item responses to include `name` object and `slug`, added safe translation mapping when `?lang=ar`.
  - `src/services/translationService.ts` improved to accept mixed name types in `generateKey` and translation helpers.
  - `src/controllers/cartControllers.ts` updated `getCart` mapping to include `nameObj` (translations object) and `itemSlug`, and `addItemToCart` stores `nameObj` and `itemSlug`.

- Utilities & sockets:
  - `src/utils/stockHelper.ts` `mapCartItemsToOrderItems` now preserves `nameObj`, and socket `itemUpdated` emits include `slug` and `name` object.
  - `src/socket/realtime.ts` emits now include `slug` and `name` object.

- Scripts:
  - `scripts/migrate-add-translations.js` created to convert existing string names -> `{ en }` and populate slugs for categories and items.

What's next (recommended):
- Update `categoryController.ts`, `pickupController.ts` (partial updates done via utils), and `courierController.ts` to ensure all responses include `name` object + `slug` when returning items/categories.
- Add unit tests for model pre-save behavior and `TranslationService.generateKey`.
- Run the migration script on a staging DB and verify API responses remain backward-compatible.


