import Translation, { ITranslation } from "../models/translation";

export class TranslationService {
  // Normalize text to consistent format (lowercase with underscores)
  static normalizeText(text: string): string {
    if (!text || typeof text !== "string") return "";

    return text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_]/gu, "") // allow underscores
      .replace(/\s+/g, "_"); // spaces to underscores
  }

  // Generate consistent translation key
  static generateKey(
    text: string,
    prefix: string = "",
    suffix: string = ""
  ): string {
    const normalizedText = this.normalizeText(text);

    let key = normalizedText;
    if (prefix) key = `${prefix}_${key}`;
    if (suffix) key = `${key}_${suffix}`;
    return key;
  }

  // Create or update a translation
  static async createOrUpdateTranslation(
    key: string,
    translations: { en?: string; ar?: string },
    type: "category" | "item" | "general",
    referenceId?: string
  ): Promise<ITranslation> {
    // Fetch existing record if exists
    const existing = await Translation.findOne({ key });

    const updatedTranslations = {
      en:
        translations.en && translations.en.trim() !== ""
          ? translations.en
          : existing?.translations?.en || "",
      ar:
        translations.ar && translations.ar.trim() !== ""
          ? translations.ar
          : existing?.translations?.ar || "",
    };

    return await Translation.findOneAndUpdate(
      { key },
      { key, translations: updatedTranslations, type, referenceId },
      { upsert: true, new: true }
    );
  }

  static async updateCategoryKeys(referenceId: string, newSlug: string) {
    const newNameKey = `cat_${newSlug}_name`;
    const newDescKey = `cat_${newSlug}_desc`;

    // Update both in parallel
    await Promise.all([
      Translation.findOneAndUpdate(
        { referenceId, key: { $regex: /_name$/ } },
        { key: newNameKey },
        { new: true }
      ),
      Translation.findOneAndUpdate(
        { referenceId, key: { $regex: /_desc$/ } },
        { key: newDescKey },
        { new: true }
      ),
    ]);

    return { newNameKey, newDescKey };
  }

  // Get all translations for a specific language
  static async getTranslations(
    language: "en" | "ar"
  ): Promise<Record<string, string>> {
    try {
      const translations = await Translation.find().lean();
      const result: Record<string, string> = {};

      translations.forEach((t) => {
        if (t && t.translations && typeof t.translations === "object") {
          const translatedText = t.translations[language];
          if (translatedText && typeof translatedText === "string") {
            result[t.key] = translatedText;
          }
        }
      });

      return result;
    } catch (error) {
      console.error("Error in getTranslations:", error);
      return {};
    }
  }

  // Check if text is Arabic
  static isArabic(text: string): boolean {
    return /[\u0600-\u06FF]/.test(text);
  }

  // Create category translations - FIXED TO STORE NORMALIZED VALUES
  static async createCategoryTranslations(
    categoryDisplayNameEn: string,
    categoryDescriptionEn: string,
    categoryDisplayNameAr?: string,
    categoryDescriptionAr?: string,
    categoryId?: string
  ) {
    const normalizedSlug = this.normalizeText(categoryDisplayNameEn);
    const normalizedDescEn = this.normalizeText(categoryDescriptionEn);

    // Fetch old translations by categoryId
    let oldTranslations: any[] = [];
    if (categoryId) {
      oldTranslations = await Translation.find({
        categoryId,
        type: "category",
      }).lean();
    }

    // If slug changed → cleanup old keys
    if (oldTranslations?.length) {
      const oldKeys = oldTranslations.map((t) => t.key);
      const stillValidKeys = [
        `cat_${normalizedSlug}_name`,
        `cat_${normalizedSlug}_desc`,
      ];

      const keysToDelete = oldKeys.filter((k) => !stillValidKeys.includes(k));
      if (keysToDelete.length) {
        await Translation.deleteMany({
          key: { $in: keysToDelete },
          type: "category",
          categoryId,
        });
      }
    }

    // Fallback for Arabic
    const fallbackNameAr =
      categoryDisplayNameAr ||
      oldTranslations.find((t) => t.key.endsWith("_name"))?.translations?.ar ||
      categoryDisplayNameEn;

    const fallbackDescAr =
      categoryDescriptionAr ||
      oldTranslations.find((t) => t.key.endsWith("_desc"))?.translations?.ar ||
      categoryDescriptionEn;

    const normalizedNameAr = fallbackNameAr;
    const normalizedDescAr = fallbackDescAr;

    const nameKey = `cat_${normalizedSlug}_name`;
    const descKey = `cat_${normalizedSlug}_desc`;

    // Save updated translations
    await Promise.all([
      this.createOrUpdateTranslation(
        nameKey,
        { en: categoryDisplayNameEn, ar: normalizedNameAr },
        "category",
        categoryId
      ),
      this.createOrUpdateTranslation(
        descKey,
        { en: categoryDescriptionEn, ar: normalizedDescAr },
        "category",
        categoryId
      ),
    ]);

    return {
      normalizedSlug,
      normalizedDescEn,
      normalizedNameAr,
      normalizedDescAr,
      nameKey,
      descKey,
    };
  }

  // Create item translation - FIXED TO STORE NORMALIZED VALUES
  static async createItemTranslation(
    itemDisplayNameEn: string,
    categoryNormalizedName: string, // This should already be normalized
    itemDisplayNameAr?: string,
    itemId?: string
  ) {
    // Generate normalized slug for database (lowercase with underscores)
    const normalizedSlug = this.normalizeText(itemDisplayNameEn);
    const normalizedNameAr = this.normalizeText(
      itemDisplayNameAr || itemDisplayNameEn
    );
    const itemKey = `${normalizedSlug}`;

    console.log("Creating item translation:", {
      normalizedSlug,
      normalizedNameAr,
      itemKey,
      categoryNormalizedName,
      displayNameEn: itemDisplayNameEn,
      displayNameAr: itemDisplayNameAr,
    });

    await this.createOrUpdateTranslation(
      itemKey,
      {
        en: itemDisplayNameEn, // Store normalized English name
        ar: itemDisplayNameAr, // Store normalized Arabic name
      },
      "item",
      itemId
    );

    return {
      normalizedSlug, // This should be used as name and slug in database
      normalizedNameAr,
      itemKey,
    };
  }

  // Translate categories
  static async translateCategories(
    categories: any[],
    language: "en" | "ar"
  ): Promise<any[]> {
    try {
      console.log(`Translating ${categories.length} categories to ${language}`);

      const translations = await this.getTranslations(language);

      const translatedCategories = categories.map((category) => {
        try {
          if (!category || !category.name) {
            console.warn("Invalid category structure:", category);
            return category;
          }

          // Category name should be normalized in database (lowercase_with_underscores)
          const normalizedName = category.name;
          const nameKey = `cat_${normalizedName}_name`;
          const descKey = `cat_${normalizedName}_desc`;

          const translatedName = translations[nameKey] || category.name;
          const translatedDescription =
            translations[descKey] || category.description;

          // Handle items translation
          const translatedItems = Array.isArray(category.items)
            ? category.items.map((item: any) => {
                if (!item || !item.name) return item;

                // Item name should be normalized in database (lowercase_with_underscores)
                const normalizedItemName = item.name;
                const itemKey = `${normalizedItemName}`;
                const translatedItemName = translations[itemKey] || item.name;

                return {
                  ...item,
                  name: translatedItemName, // Keep normalized name (lowercase_with_underscores)
                  slug: normalizedItemName, // Same as name
                  displayName: translatedItemName, // Translated display name for UI
                };
              })
            : [];

          return {
            ...category,
            name: translatedName, // Keep normalized name (lowercase_with_underscores)
            slug: normalizedName, // Same as name
            displayName: translatedName, // Use for UI display (can be original formatting)
            description: translatedDescription, // Use for UI display
            items: translatedItems,
          };
        } catch (categoryError) {
          console.error(
            `Error translating category ${category?.name}:`,
            categoryError
          );
          return category;
        }
      });

      return translatedCategories;
    } catch (error) {
      console.error("Error in translateCategories:", error);
      return categories;
    }
  }

  // Translate cart items
  static async translateCartItems(
    cartItems: any[],
    language: "en" | "ar"
  ): Promise<any[]> {
    try {
      if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return cartItems;
      }

      const translations = await this.getTranslations(language);

      return cartItems.map((item) => {
        if (!item || !item.name || !item.categoryName) return item;

        // Names should be normalized in database (lowercase_with_underscores)
        const normalizedItemName = item.name;
        const normalizedCategoryName = item.categoryName;

        const itemKey = `item_${normalizedCategoryName}_${normalizedItemName}`;
        const categoryKey = `cat_${normalizedCategoryName}_name`;

        const translatedItemName = translations[itemKey] || normalizedItemName;
        const translatedCategoryName =
          translations[categoryKey] || normalizedCategoryName;

        return {
          ...item,
          name: normalizedItemName, // Keep normalized name (lowercase_with_underscores)
          slug: normalizedItemName, // Same as name
          displayName: translatedItemName, // Translated display name for UI
          categoryName: normalizedCategoryName, // Keep normalized name (lowercase_with_underscores)
          categorySlug: normalizedCategoryName, // Same as categoryName
          categoryDisplayName: translatedCategoryName, // Translated display name for UI
        };
      });
    } catch (err) {
      console.error("Error in translateCartItems:", err);
      return cartItems;
    }
  }

  // Translate orders
  static async translateOrders(
    orders: any[],
    language: "en" | "ar"
  ): Promise<any[]> {
    const translations = await this.getTranslations(language);

    return orders.map((order) => {
      if (!order || !Array.isArray(order.items)) return order;

      const translatedItems = order.items.map((item) => {
        if (!item || !item.itemName || !item.categoryName) return item;

        // Names should be normalized in database (lowercase_with_underscores)
        const normalizedItemName = item.itemName;
        const normalizedCategoryName = item.categoryName;

        const itemKey = `item_${normalizedCategoryName}_${normalizedItemName}`;
        const categoryKey = `cat_${normalizedCategoryName}_name`;

        const translatedItemName = translations[itemKey] || normalizedItemName;
        const translatedCategoryName =
          translations[categoryKey] || normalizedCategoryName;

        return {
          ...item,
          itemName: normalizedItemName, // Keep normalized name (lowercase_with_underscores)
          itemSlug: normalizedItemName, // Same as itemName
          itemDisplayName: translatedItemName, // Translated display name for UI
          categoryName: normalizedCategoryName, // Keep normalized name (lowercase_with_underscores)
          categorySlug: normalizedCategoryName, // Same as categoryName
          categoryDisplayName: translatedCategoryName, // Translated display name for UI
        };
      });

      return {
        ...order,
        items: translatedItems,
      };
    });
  }

  // Get item translation by normalized name
  static async getItemTranslation(
    normalizedItemName: string,
    normalizedCategoryName: string,
    language: "en" | "ar"
  ): Promise<string> {
    try {
      const itemKey = `${normalizedItemName}`;
      const translation = await Translation.findOne({ key: itemKey }).lean();

      if (translation && translation.translations[language]) {
        return translation.translations[language];
      }

      // Fallback to the normalized name
      return normalizedItemName;
    } catch (error) {
      console.error("Error getting item translation:", error);
      return normalizedItemName;
    }
  }

  // Get category translation by normalized name
  static async getCategoryTranslation(
    normalizedCategoryName: string,
    language: "en" | "ar"
  ): Promise<string> {
    try {
      const nameKey = `cat_${normalizedCategoryName}_name`;
      const translation = await Translation.findOne({ key: nameKey }).lean();

      if (translation && translation.translations[language]) {
        return translation.translations[language];
      }

      // Fallback to the normalized name
      return normalizedCategoryName;
    } catch (error) {
      console.error("Error getting category translation:", error);
      return normalizedCategoryName;
    }
  }

  // Find translation by normalized text
  static async getTheRightTrnslation(text: string, type: "category" | "item") {
    const normalizedText = this.normalizeText(text);
    const language = this.isArabic(text) ? "ar" : "en";

    console.log(
      `Looking for translation: type=${type}, normalized="${normalizedText}", lang=${language}`
    );

    return await Translation.findOne({
      type,
      [`translations.${language}`]: normalizedText,
    }).lean();
  }

  // Get missing translations
  static async getMissingTranslations(): Promise<{
    categories: string[];
    items: string[];
  }> {
    try {
      const Category = (await import("../models/category")).default;

      const categories = await Category.find().lean();
      const translations = await Translation.find().lean();
      const translationKeys = new Set(translations.map((t) => t.key));

      const missingCategories: string[] = [];
      const missingItems: string[] = [];

      categories.forEach((category) => {
        if (!category || !category.name) return;

        // Category name should be normalized (lowercase_with_underscores)
        const normalizedCategoryName = category.name;
        const nameKey = `cat_${normalizedCategoryName}_name`;
        const descKey = `cat_${normalizedCategoryName}_desc`;

        if (!translationKeys.has(nameKey)) {
          missingCategories.push(`${normalizedCategoryName} (name)`);
        }
        if (!translationKeys.has(descKey)) {
          missingCategories.push(`${normalizedCategoryName} (description)`);
        }

        if (Array.isArray(category.items)) {
          category.items.forEach((item: any) => {
            if (!item || !item.name) return;

            // Item name should be normalized (lowercase_with_underscores)
            const normalizedItemName = item.name;
            const itemKey = `item_${normalizedCategoryName}_${normalizedItemName}`;

            if (!translationKeys.has(itemKey)) {
              missingItems.push(
                `${normalizedCategoryName} - ${normalizedItemName}`
              );
            }
          });
        }
      });

      return { categories: missingCategories, items: missingItems };
    } catch (error) {
      console.error("Error in getMissingTranslations:", error);
      return { categories: [], items: [] };
    }
  }

  // Fix existing translation records to follow normalization standards
  static async fixExistingTranslations() {
    try {
      console.log("Starting translation fix...");

      // Get all existing translations
      const translations = await Translation.find().lean();

      for (const translation of translations) {
        let needsUpdate = false;
        const updatedTranslations = { ...translation.translations };

        // Check and fix English translation
        if (updatedTranslations.en) {
          const normalizedEn = this.normalizeText(updatedTranslations.en);
          if (updatedTranslations.en !== normalizedEn) {
            console.log(
              `Fixing EN: "${updatedTranslations.en}" -> "${normalizedEn}"`
            );
            updatedTranslations.en = normalizedEn;
            needsUpdate = true;
          }
        }

        // Check and fix Arabic translation
        if (updatedTranslations.ar) {
          const normalizedAr = this.normalizeText(updatedTranslations.ar);
          if (updatedTranslations.ar !== normalizedAr) {
            console.log(
              `Fixing AR: "${updatedTranslations.ar}" -> "${normalizedAr}"`
            );
            updatedTranslations.ar = normalizedAr;
            needsUpdate = true;
          }
        }

        // Update if needed
        if (needsUpdate) {
          await Translation.findByIdAndUpdate(
            translation._id,
            { translations: updatedTranslations },
            { new: true }
          );
        }
      }

      console.log("Translation fix completed!");
    } catch (error) {
      console.error("Error fixing existing translations:", error);
    }
  }

  // Complete normalization of both database and translations
  static async normalizeExistingData() {
    try {
      const Category = (await import("../models/category")).default;
      const categories = await Category.find();

      console.log("Starting complete normalization...");

      // Step 1: Fix database records
      for (const category of categories) {
        const originalName = category.name;
        const normalizedName = this.normalizeText(originalName);
        let hasChanges = false;

        // Normalize category name and slug
        if (originalName !== normalizedName) {
          console.log(
            `Normalizing category: "${originalName}" -> "${normalizedName}"`
          );

          category.name = normalizedName; // Set to lowercase_with_underscores
          category.slug = normalizedName; // Same as name
          hasChanges = true;
        }

        // Normalize items
        if (Array.isArray(category.items)) {
          category.items.forEach((item: any) => {
            if (item && item.name) {
              const originalItemName = item.name;
              const normalizedItemName = this.normalizeText(originalItemName);

              if (originalItemName !== normalizedItemName) {
                console.log(
                  `  Normalizing item: "${originalItemName}" -> "${normalizedItemName}"`
                );
                item.name = normalizedItemName; // Set to lowercase_with_underscores
                item.slug = normalizedItemName; // Same as name
                hasChanges = true;
              }
            }
          });
        }

        if (hasChanges) {
          await category.save();
        }
      }

      // Step 2: Fix translation records
      await this.fixExistingTranslations();

      console.log("Complete normalization completed!");
      console.log(
        "✅ Database: All names and slugs now follow lowercase_with_underscores format"
      );
      console.log(
        "✅ Translations: All translation values now follow lowercase_with_underscores format"
      );
    } catch (error) {
      console.error("Error in complete normalization:", error);
    }
  }
}
