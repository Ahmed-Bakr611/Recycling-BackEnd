import { strict as assert } from 'assert';
import { TranslationService } from '../../src/services/translationService';

console.log('Running TranslationService.generateKey tests...');

const k1 = TranslationService.generateKey('Paper', 'cat', 'name');
assert.equal(typeof k1, 'string', 'key should be a string');
assert.ok(k1.startsWith('cat_'), 'prefix applied');

const k2 = TranslationService.generateKey({ en: 'Shredded Paper' }, 'item');
assert.equal(typeof k2, 'string');
assert.ok(k2.includes('shredded_paper'));

console.log('TranslationService.generateKey tests passed.');
