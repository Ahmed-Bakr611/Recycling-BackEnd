import express from 'express';
import { addItemToCart, clearCart, getCart, removeCartItem, updateCartItem } from '../controllers/cartControllers'
import { ensureSessionId } from '../middlewares/session';

const router = express.Router();

router.use(ensureSessionId);

router.get('/', getCart);                   // GET /api/cart
router.post('/', addItemToCart);               // POST /api/cart/
router.put('/', updateCartItem);          // PUT /api/cart/
router.delete('/:categoryId', removeCartItem);  // DELETE /api/cart/:categoryId
router.delete('/', clearCart);         // DELETE /api/cart/

export default router;