# Recycling-BackEnd

This is the backend for a recycling platform, built with Node.js, Express, and MongoDB (Mongoose). It provides RESTful APIs for user authentication, category and item management, cart operations, order processing, and more. This README is designed to help frontend developers understand the backend structure, endpoints, and data models, especially for cart and item management.

---

## Table of Contents
- [Project Structure](#project-structure)
- [Key Models](#key-models)
- [Cart Item Schema](#cart-item-schema)
- [API Endpoints](#api-endpoints)
  - [Categories & Items](#categories--items)
  - [Cart](#cart)
  - [Orders](#orders)
- [Cart Data Example](#cart-data-example)
- [Validation Rules](#validation-rules)
- [Useful Tips for Frontend](#useful-tips-for-frontend)
- [Extra Notes](#extra-notes)

---

## Project Structure

```
├── src/
│   ├── controllers/         # Route handlers (cartControllers.ts, ...)
│   ├── models/              # Mongoose schemas (cart.ts, item.ts, ...)
│   ├── routes/              # Express route definitions
│   ├── middlewares/         # Auth, session, etc.
│   ├── services/            # Business logic
│   └── utils/               # Helpers
├── uploads/                 # Uploaded files (e.g., delivery proofs)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Key Models

### Item (`src/models/item.ts`)
- `_id`: string (MongoDB ObjectId)
- `name`: string
- `points`: number
- `price`: number
- `quantity`: number
- `measurement_unit`: 1 (KG) or 2 (PIECE)
- `image`: string (URL)
- `categoryName`: string
- `categoryId`: string (reference to category)

### Cart Item (`src/models/cart.ts`)
- `_id`: string (item _id)
- `categoryId`: string (category _id)
- `name`: string
- `image`: string
- `points`: number
- `price`: number
- `categoryName`: string
- `measurement_unit`: number (1 = KG, 2 = PIECE)
- `quantity`: number

---

## Cart Item Schema

**New Cart Item Schema:**
```js
{
  _id: string,           // Item _id (from items collection)
  categoryId: string,    // Category _id
  name: string,          // Item name
  image: string,         // Item image URL
  points: number,        // Points per item
  price: number,         // Price per item
  categoryName: string,  // Category name
  measurement_unit: 1|2, // 1 = KG, 2 = PIECE
  quantity: number       // Quantity (see validation below)
}
```

---

## API Endpoints

### Categories & Items
- `GET /api/categories?role=customer&limit=5`  
  Returns categories with their items. Each item includes `_id`, `name`, `points`, `price`, `measurement_unit`, `image`, `quantity`, `categoryName`, etc.
- `GET /api/categories/get-items?role=customer`  
  Returns a flat list of all items with full details, including `_id` and `categoryId`.
- `GET /api/categories/get-items/:categoryName?role=customer`  
  Returns items for a specific category.

### Cart
- `GET /api/cart`  
  Get the current user's/session's cart.
- `POST /api/cart`  
  Add an item to the cart. Body must include all cart item fields (see schema above).
- `PUT /api/cart`  
  Update an item's quantity in the cart. Body: `{ _id, quantity }`.
- `DELETE /api/cart/:_id`  
  Remove an item from the cart by its `_id`.
- `DELETE /api/cart/`  
  Clear the entire cart.

export default (router: express.Router) => {
  router.get("/cart", optionalAuthenticate, getCart);
  router.post("/cart", optionalAuthenticate,addItemToCart);
  router.put("/cart", optionalAuthenticate,updateCartItem);
  router.delete("/cart/:categoryId", optionalAuthenticate,removeCartItem);
  router.delete("/cart/", optionalAuthenticate, clearCart);
};

### Orders
- `POST /api/orders`  
  Create a new order. Items array must include `_id`, `categoryId`, `itemName`, `image`, `measurement_unit`, `points`, `price`, `quantity`, etc.

---

## Cart Data Example

**New Cart Example:**
```json
{
  "_id": "...",
  "sessionId": "...",
  "items": [
    {
      "_id": "687d76ddba6a94b1537a1aed",
      "categoryId": "687d76c4ba6a94b1537a1ae5",
      "name": "shredded paper",
      "image": "...",
      "points": 38,
      "price": 2,
      "categoryName": "paper",
      "measurement_unit": 1,
      "quantity": 5
    },
    // ... more items ...
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## Validation Rules
- **measurement_unit = 1 (KG):**
  - `quantity` must be in 0.25 increments (e.g., 0.25, 0.5, 0.75, 1.0, ...)
- **measurement_unit = 2 (PIECE):**
  - `quantity` must be a whole number >= 1
- Validation is enforced both in the backend controller and the Mongoose schema.

---

## Useful Tips for Frontend
- Always send both `_id` (item id) and `categoryId` when adding items to the cart.
- Use the `/api/categories/get-items` endpoint to get all items with both `_id` and `categoryId` for cart operations.
- When displaying the cart, use the `items` array from the cart object. Each item will have both `_id` and `categoryId`.
- For updating/removing cart items, use the item's `_id`.
- The cart is associated with either a `userId` (logged-in user) or a `sessionId` (guest user).
- If you need to display available quantity, use the `quantity` field from the item endpoints, not the cart.
- When creating an order, pass the cart's items array as the `items` field in the order payload.

---

## Extra Notes
- **Session vs User:**
  - If the user is not logged in, the cart is tied to a `sessionId` (from cookies or local storage).
  - If logged in, the cart is tied to `userId`.
- **Item Naming:**
  - In some endpoints, the item name field may be `name` or `itemName`. Always use the value from the item object.
- **Error Handling:**
  - The backend returns clear error messages for invalid quantity, missing fields, or not found items.
- **Extensibility:**
  - The backend is designed to support both authenticated and guest users, and can be extended for more item types or cart features.

---

## Contact & Contribution
For questions or contributions, please open an issue or pull request on the repository.

---

**This README is AI-generated and tailored for frontend integration.**
