import { strict as assert } from 'assert';
import { mapCartItemsToOrderItems } from '../../src/utils/stockHelper';

console.log('Running mapCartItemsToOrderItems test...');

const mockCartItems = [
  {
    _id: '64a1f1b2c3d4e5f678901234',
    categoryId: '64a1f1b2c3d4e5f678901200',
    categoryName: 'Paper',
    name: 'Shredded Paper',
    image: '/img/paper.png',
    points: 2,
    price: 0.1,
    measurement_unit: 1,
    quantity: 1
  }
];

const orderItems = mapCartItemsToOrderItems(mockCartItems as any);

assert.equal(orderItems.length, 1, 'Should map one item');
const oi = orderItems[0];
assert.equal(oi.itemName, 'Shredded Paper');
assert.ok(oi.nameObj && oi.nameObj.en === 'Shredded Paper', 'nameObj should be present with en');
console.log('mapCartItemsToOrderItems test passed.');
