import Translation, { ITranslation } from '../models/translation';

export class TranslationService {
  // Create or update a translation
  static async createOrUpdateTranslation(
    key: string,
    translations: { en: string; ar: string },
    type: 'category' | 'item' | 'general',
    referenceId?: string
  ): Promise<ITranslation> {
    return await Translation.findOneAndUpdate(
      { key },
      { key, translations, type, referenceId },
      { upsert: true, new: true }
    );
  }
// In TranslationService.ts
static async translateOrders(orders: any[], language: 'en' | 'ar'): Promise<any[]> {
  const translations = await this.getTranslations(language);

  return orders.map(order => {
    if (!order || !Array.isArray(order.items)) return order;

    const translatedItems = order.items.map(item => {
      if (!item || !item.itemName || !item.categoryName) return item;

      const itemKey = this.generateKey(`${item.categoryName}_${item.itemName}`, 'item');
      const translatedItemName = translations[itemKey] || item.itemName;

      const categoryKey = this.generateKey(item.categoryName, 'cat', 'name');
      const translatedCategoryName = translations[categoryKey] || item.categoryName;

      return {
        ...item,
        itemName: translatedItemName,
        categoryName: translatedCategoryName
      };
    });

    return {
      ...order,
      items: translatedItems
    };
  });
}
  static async getItemTranslation(itemName: string, language: 'en' | 'ar'): Promise<string> {
    // Try multiple lookup strategies
    const translations = await Translation.find({
      $or: [
        { key: `item_${itemName}` },
        { 'translations.ar': itemName },
        { 'translations.en': itemName }
      ]
    });

    // Return the first valid translation found
    for (const t of translations) {
      if (t.translations[language]) {
        return t.translations[language];
      }
      if (t.translations.en) {
        return t.translations.en;
      }
    }

    // Manual fallback for known items
    const manualFallbacks: Record<string, string> = {
      'اكريلك': 'acrylic',
      'بلاستيك': 'plastic'
    };

    return manualFallbacks[itemName] || itemName;
  }

  static async translateItems(items: any[], language: 'en' | 'ar'): Promise<any[]> {
    return Promise.all(items.map(async item => {
      const translatedName = await this.getItemTranslation(item.itemName, language);
      return {
        ...item,
        itemName: translatedName,
        nameVariations: await Promise.all(
          (item.nameVariations || []).map((name: string) => 
            this.getItemTranslation(name, language)
          )
        )
      };
    }));
  }
static async translateCartItems(
  cartItems: any[],
  language: 'en' | 'ar'
): Promise<any[]> {
  try {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return cartItems;
    }

    const translations = await this.getTranslations(language);

    return cartItems.map(item => {
      if (!item || !item.name || !item.categoryName) return item;

      const itemKey = this.generateKey(`${item.categoryName}_${item.name}`, 'item');
      const translatedItemName = translations[itemKey] || item.name;

      const categoryKey = this.generateKey(item.categoryName, 'cat', 'name');
      const translatedCategoryName = translations[categoryKey] || item.categoryName;

      return {
        ...item,
        name: translatedItemName,
        categoryName: translatedCategoryName
      };
    });
  } catch (err) {
    console.error('Error in translateCartItems:', err);
    return cartItems;
  }
}

  // Get all translations for a specific language - FIXED VERSION
  static async getTranslations(language: 'en' | 'ar'): Promise<Record<string, string>> {
    try {
      const translations = await Translation.find().lean();
      const result: Record<string, string> = {};
      
      console.log(`Found ${translations.length} translation records for language: ${language}`);
      
      // DEBUG: Show all keys in database
      console.log('All translation keys in database:', translations.map(t => t.key));
      
      translations.forEach(t => {
        // Add null/undefined checks here
        if (t && t.translations && typeof t.translations === 'object') {
          const translatedText = t.translations[language];
          if (translatedText && typeof translatedText === 'string') {
            result[t.key] = translatedText;
            console.log(`Added translation: ${t.key} -> ${translatedText}`);
          } else {
            console.warn(`Missing ${language} translation for key: ${t.key}`, t.translations);
          }
        } else {
          console.warn(`Invalid translation record structure for key: ${t?.key}`, t);
        }
      });
      
      console.log(`Successfully processed ${Object.keys(result).length} translations for ${language}`);
      console.log('Final translation keys:', Object.keys(result));
      return result;
    } catch (error) {
      console.error('Error in getTranslations:', error);
      return {}; // Return empty object on error
    }
  }
static async findCategoryTranslationByLang(text: string, lang: 'en' | 'ar') {
  return await Translation.findOne({
    type: 'category',
    [`translations.${lang}`]: text
  }).lean();
}
  // Generate translation key from text
static generateKey(text: string, prefix: string = '', suffix: string = ''): string {
  if (!text || typeof text !== 'string') return '';

  const cleanText = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // letters & numbers only
    .replace(/\s+/g, '_'); // spaces to underscores

  let key = cleanText;
  if (prefix) key = `${prefix}_${key}`;
  if (suffix) key = `${key}_${suffix}`;
  return key;
}


  // Create translation keys for category and items
  static async createCategoryTranslations(
    categoryName: string,
    categoryDescription: string,
    categoryNameAr?: string,
    categoryDescriptionAr?: string,
    categoryId?: string
  ) {
    const nameKey = this.generateKey(categoryName, 'cat', 'name');
    const descKey = this.generateKey(categoryName, 'cat', 'desc');

    console.log('Creating translations with keys:', { nameKey, descKey });

    await Promise.all([
      this.createOrUpdateTranslation(
        nameKey,
        { en: categoryName, ar: categoryNameAr || categoryName },
        'category',
        categoryId
      ),
      this.createOrUpdateTranslation(
        descKey,
        { en: categoryDescription, ar: categoryDescriptionAr || categoryDescription },
        'category',
        categoryId
      )
    ]);

    return { nameKey, descKey };
  }

  // Create translation for item
  static async createItemTranslation(
    itemName: string,
    categoryName: string,
    itemNameAr?: string,
    itemId?: string
  ) {
    const itemKey = this.generateKey(`${categoryName}_${itemName}`, 'item');
    
    await this.createOrUpdateTranslation(
      itemKey,
      { en: itemName, ar: itemNameAr || itemName },
      'item',
      itemId
    );

    return itemKey;
  }

  // Translate categories with their items - IMPROVED VERSION
static async translateCategories(
  categories: any[],
  language: 'en' | 'ar'
): Promise<any[]> {
  try {
    console.log(`Starting translation of ${categories.length} categories to ${language}`);
    
    const translations = await this.getTranslations(language);
    console.log(`Retrieved ${Object.keys(translations).length} translations`);

    const translatedCategories = categories.map(category => {
      try {
        if (!category || !category.name) {
          console.warn('Invalid category structure:', category);
          return category;
        }

        const nameKey = this.generateKey(category.name, 'cat', 'name');
        const descKey = this.generateKey(category.name, 'cat', 'desc');

        const translatedName = translations[nameKey] || category.name;
        const translatedDescription = translations[descKey] || category.description;

        if (!translations[nameKey]) {
          console.warn(`No translation for category key: "${nameKey}", using original name: "${category.name}"`);
        }
        if (!translations[descKey]) {
          console.warn(`No translation for category description key: "${descKey}", using original description.`);
        }

        // Handle items translation
        const translatedItems = Array.isArray(category.items)
          ? category.items.map((item: any) => {
              if (!item || !item.name) return item;

              const itemKey = this.generateKey(`${category.name}_${item.name}`, 'item');
              const translatedItemName = translations[itemKey] || item.name;

              if (!translations[itemKey]) {
                console.warn(`No translation found for item key: "${itemKey}", using original name: "${item.name}"`);
              }

              return { ...item, name: translatedItemName };
            })
          : [];

        return {
          ...category,
          name: translatedName,
          description: translatedDescription,
          items: translatedItems
        };
      } catch (categoryError) {
        console.error(`Error translating category ${category?.name}:`, categoryError);
        return category; // Return original on error
      }
    });

    console.log(`Successfully translated ${translatedCategories.length} categories`);
    return translatedCategories;

  } catch (error) {
    console.error('Error in translateCategories:', error);
    return categories; // Return original categories on error
  }
}

  // Get missing translations (for admin dashboard)
  static async getMissingTranslations(): Promise<{
    categories: string[];
    items: string[];
  }> {
    try {
      const Category = (await import('../models/category')).default;
      
      const categories = await Category.find().lean();
      const translations = await Translation.find().lean();
      const translationKeys = new Set(translations.map(t => t.key));
      
      const missingCategories: string[] = [];
      const missingItems: string[] = [];
      
      categories.forEach(category => {
        if (!category || !category.name) return;
        
        const nameKey = this.generateKey(category.name, 'cat', 'name');
        const descKey = this.generateKey(category.name, 'cat', 'desc');
        
        if (!translationKeys.has(nameKey)) {
          missingCategories.push(`${category.name} (name)`);
        }
        if (!translationKeys.has(descKey)) {
          missingCategories.push(`${category.name} (description)`);
        }
        
        if (Array.isArray(category.items)) {
          category.items.forEach((item: any) => {
            if (item && item.name) {
              const itemKey = this.generateKey(`${category.name}_${item.name}`, 'item');
              if (!translationKeys.has(itemKey)) {
                missingItems.push(`${category.name} - ${item.name}`);
              }
            }
          });
        }
      });
      
      return { categories: missingCategories, items: missingItems };
    } catch (error) {
      console.error('Error in getMissingTranslations:', error);
      return { categories: [], items: [] };
    }
  }
}