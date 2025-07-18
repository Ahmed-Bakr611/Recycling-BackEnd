import express from 'express';
import { addItemToCart, getCart, updateCartItem, removeCartItem, clearCart } from '../controllers/cartControllers';

const router = express.Router();

router.get('/', getCart);
router.post('/', addItemToCart);
router.put('/', updateCartItem);
router.delete('/:categoryId', removeCartItem);
router.delete('/', clearCart);

export default router;
