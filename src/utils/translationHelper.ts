// Enhanced translation helper utility with improved error handling
// Replace your existing translationHelper.ts with this fixed version

import { TranslationService } from "../services/translationService";

export interface TranslationContext {
  language: 'en' | 'ar';
  translations?: Record<string, string>;
}

interface CategoryWithItems {
  _id?: any;
  name: string;
  description?: string;
  slug?: string;
  items?: ItemWithCategory[];
  [key: string]: any;
}

interface ItemWithCategory {
  _id?: any;
  name?: string;
  itemName?: string;
  categoryName?: string;
  categoryId?: any;
  slug?: string;
  slugItem?: string;
  [key: string]: any;
}

export class TranslationHelper {
  /**
   * Apply translations to a single category
   */
  static async translateCategory(
    category: CategoryWithItems, 
    context: TranslationContext
  ): Promise<CategoryWithItems> {
    if (context.language === 'en') return category;
    
    try {
      const translations = context.translations || await TranslationService.getTranslations(context.language);
      
      // Translate category fields
      const categoryNameKey = TranslationService.generateKey(category.name, 'cat', 'name');
      const categoryDescKey = TranslationService.generateKey(category.name, 'cat', 'desc');
      
      const translatedCategory = {
        ...category,
        name: translations[categoryNameKey] || category.name,
        description: translations[categoryDescKey] || category.description,
        originalName: category.name, // Keep for reference
      };
      
      // Translate items if they exist
      if (category.items && Array.isArray(category.items)) {
        translatedCategory.items = category.items.map(item => 
          this.translateItem(item, category.name, translations)
        );
      }
      
      return translatedCategory;
    } catch (error) {
      console.error('Category translation failed:', error);
      return category;
    }
  }
  
  /**
   * Apply translations to multiple categories
   */
  static async translateCategories(
    categories: CategoryWithItems[], 
    context: TranslationContext
  ): Promise<CategoryWithItems[]> {
    if (context.language === 'en') return categories;
    if (!categories?.length) return categories;
    
    try {
      const translations = context.translations || await TranslationService.getTranslations(context.language);
      const contextWithTranslations = { ...context, translations };
      
      return categories.map(category => 
        this.translateCategorySync(category, contextWithTranslations)
      );
    } catch (error) {
      console.error('Categories translation failed:', error);
      return categories;
    }
  }
  
  /**
   * Synchronous category translation (when translations are already loaded)
   */
  private static translateCategorySync(
    category: CategoryWithItems,
    context: TranslationContext & { translations: Record<string, string> }
  ): CategoryWithItems {
    const { translations } = context;
    
    const categoryNameKey = TranslationService.generateKey(category.name, 'cat', 'name');
    const categoryDescKey = TranslationService.generateKey(category.name, 'cat', 'desc');
    
    const translatedCategory = {
      ...category,
      name: translations[categoryNameKey] || category.name,
      description: translations[categoryDescKey] || category.description,
      originalName: category.name,
    };
    
    if (category.items && Array.isArray(category.items)) {
      translatedCategory.items = category.items.map(item => 
        this.translateItem(item, category.name, translations)
      );
    }
    
    return translatedCategory;
  }
  
  /**
   * Apply translations to a single item
   */
  static translateItem(
    item: ItemWithCategory, 
    originalCategoryName: string, 
    translations: Record<string, string>
  ): ItemWithCategory {
    const itemName = item.itemName || item.name;
    if (!itemName) return item;
    
    const itemKey = TranslationService.generateKey(`${originalCategoryName}_${itemName}`, 'item');
    const categoryKey = TranslationService.generateKey(originalCategoryName, 'cat', 'name');
    
    return {
      ...item,
      itemName: translations[itemKey] || itemName,
      name: translations[itemKey] || itemName, // Handle both field names
      categoryName: translations[categoryKey] || originalCategoryName,
    };
  }
  
  /**
   * Apply translations to multiple items
   */
  static async translateItems(
    items: ItemWithCategory[], 
    context: TranslationContext
  ): Promise<ItemWithCategory[]> {
    if (context.language === 'en') return items;
    if (!items?.length) return items;
    
    try {
      const translations = context.translations || await TranslationService.getTranslations(context.language);
      
      return items.map(item => {
        const originalCategoryName = item.categoryName || 'Unknown';
        return this.translateItem(item, originalCategoryName, translations);
      });
    } catch (error) {
      console.error('Items translation failed:', error);
      return items;
    }
  }
  
  /**
   * Extract language from request with better error handling
   */
  static extractLanguage(req: any): 'en' | 'ar' {
    try {
      // Add null/undefined checks for req
      if (!req) {
        console.warn('Request object is undefined, defaulting to English');
        return 'en';
      }

      // Check multiple sources with proper error handling
      let language: string | undefined;

      // Try query parameter first
      if (req.query && typeof req.query === 'object') {
        language = req.query.lang || req.query.language;
      }

      // Try body parameter if query doesn't exist
      if (!language && req.body && typeof req.body === 'object') {
        language = req.body.lang || req.body.language;
      }

      // Try headers
      if (!language && req.headers && typeof req.headers === 'object') {
        language = req.headers['accept-language'] || req.headers['x-language'];
      }

      // Try direct property on request
      if (!language && req.language) {
        language = req.language;
      }

      // Validate and return
      if (language && (language === 'ar' || language === 'arabic')) {
        return 'ar';
      }
      
      // Default to English for any other case
      return 'en';
    } catch (error) {
      console.error('Error extracting language from request:', error);
      return 'en'; // Safe fallback
    }
  }
  
  /**
   * Create translation context from request with better error handling
   */
  static createContext(req: any): TranslationContext {
    try {
      return {
        language: this.extractLanguage(req)
      };
    } catch (error) {
      console.error('Error creating translation context:', error);
      return {
        language: 'en' // Safe fallback
      };
    }
  }
  
  /**
   * Apply translations to order items
   */
  static async translateOrderItems(
    orderItems: any[], 
    context: TranslationContext
  ): Promise<any[]> {
    if (context.language === 'en') return orderItems;
    if (!orderItems?.length) return orderItems;
    
    try {
      const translations = context.translations || await TranslationService.getTranslations(context.language);
      
      return orderItems.map(item => {
        const itemName = item.itemName || item.name;
        const categoryName = item.categoryName || 'Unknown';
        
        if (!itemName || !categoryName) return item;
        
        const itemKey = TranslationService.generateKey(`${categoryName}_${itemName}`, 'item');
        const categoryKey = TranslationService.generateKey(categoryName, 'cat', 'name');
        
        return {
          ...item,
          itemName: translations[itemKey] || itemName,
          categoryName: translations[categoryKey] || categoryName,
        };
      });
    } catch (error) {
      console.error('Order items translation failed:', error);
      return orderItems;
    }
  }

  /**
   * Safe method to check if request has pagination
   */
  static hasPagination(req: any): boolean {
    try {
      return req && req.pagination && typeof req.pagination === 'object';
    } catch {
      return false;
    }
  }

  /**
   * Safe method to get pagination from request
   */
  static getPagination(req: any): { skip: number; limit: number; page: number } {
    try {
      if (this.hasPagination(req)) {
        return req.pagination;
      }
      
      // Extract from query params if pagination middleware wasn't applied
      const page = parseInt(req?.query?.page) || 1;
      const limit = parseInt(req?.query?.limit) || 10;
      const skip = (page - 1) * limit;
      
      return { skip, limit, page };
    } catch (error) {
      console.error('Error getting pagination:', error);
      return { skip: 0, limit: 10, page: 1 };
    }
  }
}