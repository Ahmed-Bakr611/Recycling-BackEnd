import { Request, Response } from "express";
import Category, { ICategory } from "../models/category";
import translationService from "../utils/translationInstance"; // Import the singleton
import { IBilingualText } from "../models/item";
import mongoose from "mongoose";

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

// Utility function to create bilingual text object
const createBilingualText = (en: string, ar?: string): IBilingualText => {
  return {
    en: en,
    ar: ar || en // Fallback to English if Arabic not provided
  };
};

// Utility function to get category key for translation files (using English name)
const getCategoryKey = (category: ICategory): string => {
  return category.name.en;
};

export const createCategory = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { 
      name, 
      description, 
      nameAr, 
      descriptionAr 
    } = req.body;

    // Validate that at least English name is provided
    if (!name) {
      res.status(400).json({ message: "English name is required" });
      return;
    }

    const image = req.file?.path ?? "";

    // Create category with bilingual names stored in database
    const category = new Category({ 
      name: createBilingualText(name, nameAr),
      description: createBilingualText(description || `${name} category`, descriptionAr),
      image, 
      items: [] 
    });
    
    await category.save();

    // Optionally still update translation files for backward compatibility
    console.log('🔄 Adding bilingual category translation to files');
    try {
      const categoryKey = getCategoryKey(category);
      
      await translationService.addCategoryTranslation(
        categoryKey,
        { en: category.name.en, ar: category.name.ar },
        { en: category.description.en, ar: category.description.ar }
      );
      
      console.log('✅ Bilingual translation added successfully');
    } catch (translationError) {
      console.error('⚠️ Translation file update failed but category was created:', translationError);
    }

    res.status(201).json(category);
  } catch (err) {
    console.error('❌ Create category error:', err);
    res.status(400).json({ message: (err as Error).message });
  }
};

export const getAllCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const language = req.query.language as 'en' | 'ar' || 'en'; // Get preferred language

    const [categories, total] = await Promise.all([
      Category.find().skip(skip).limit(limit).lean(),
      Category.countDocuments(),
    ]);

    // Transform categories based on language preference
    const transformedCategories = categories.map(category => ({
      ...category,
      // Keep full bilingual data but add displayName for convenience
      displayName: category.name[language] || category.name.en,
      displayDescription: category.description[language] || category.description.en,
      items: category.items?.map((item: any) => ({
        ...item,
        displayName: item.name?.[language] || item.name?.en || item.name
      })) || []
    }));

    res.paginated(transformedCategories, total);
  } catch (err) {
    console.error('❌ Get all categories error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getCategoriesWithPagination = async (
  req: Request,
  res: Response
) => {
  try {
    const role = req.query.role;
    const language = req.query.language as 'en' | 'ar' || 'en';
    
    const [categories, total] = await Promise.all([
      Category.find().skip(req.pagination.skip).limit(req.pagination.limit).lean(),
      Category.countDocuments(),
    ]);

    // Transform categories with language-specific display
    const transformedCategories = categories.map(category => {
      return {
        ...category,
        displayName: category.name[language] || category.name.en,
        displayDescription: category.description[language] || category.description.en,
        items: Array.isArray(category.items)
          ? category.items.map((item: any) => ({
              ...item,
              displayName: item.name?.[language] || item.name?.en || item.name,
              price: role === "buyer" && item.price 
                ? Math.round(item.price * 1.5 * 100) / 100 
                : item.price
            }))
          : [],
      };
    });

    res.json({
      success: true,
      data: transformedCategories,
      pagination: {
        currentPage: req.pagination.page,
        itemsPerPage: req.pagination.limit,
        totalItems: total,
        totalPages: Math.ceil(total / req.pagination.limit),
        hasNextPage: req.pagination.skip + req.pagination.limit < total,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

export const createCategoryWithImage = async (
  req: MulterRequest,
  res: Response
): Promise<void> => {
  try {
    const { 
      name, 
      description, 
      nameAr, 
      descriptionAr,
      itemName, 
      itemNameAr,
      points, 
      price, 
      measurement_unit 
    } = req.body;

    if (!name || !itemName) {
      res.status(400).json({ message: "English name and item name are required" });
      return;
    }

    const newCategory = new Category({
      name: createBilingualText(name, nameAr),
      description: createBilingualText(description || `${name} category`, descriptionAr),
      image: req.file?.path ?? "",
      items: [
        {
          name: createBilingualText(itemName, itemNameAr),
          image: req.file?.path ?? "",
          points: Number(points),
          price: Number(price),
          measurement_unit,
        },
      ],
    });

    await newCategory.save();

    console.log('🔄 Adding bilingual category and item translations to files');
    try {
      const categoryKey = getCategoryKey(newCategory);
      
      // Add category translation to files
      await translationService.addCategoryTranslation(
        categoryKey,
        { en: newCategory.name.en, ar: newCategory.name.ar },
        { en: newCategory.description.en, ar: newCategory.description.ar }
      );

      // Add item translation to files
      await translationService.addItemTranslation(
        categoryKey,
        newCategory.items[0].name.en, // Use English name as key
        { en: newCategory.items[0].name.en, ar: newCategory.items[0].name.ar }
      );

      console.log('✅ Both bilingual translations added successfully');
    } catch (translationError) {
      console.error('⚠️ Translation failed but category was created:', translationError);
    }

    res.status(201).json(newCategory);
  } catch (err) {
    console.error('❌ Create category with image error:', err);
    res.status(400).json({ message: (err as Error).message });
  }
};

export const updateCategory = async (
  req: MulterRequest,
  res: Response
): Promise<void> => { 
  try {
    const { categoryName } = req.params;
    const { 
      name, 
      description, 
      nameAr, 
      descriptionAr,
      image: imageFromBody 
    } = req.body;
    const imageFromFile = req.file?.path;

    // Find category by English name
    const category = await Category.findOne({ 
      "name.en": categoryName 
    });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    const oldNameEn = category.name.en;

    // Update database fields
    if (name) category.name.en = name;
    if (nameAr) category.name.ar = nameAr;
    if (description) category.description.en = description;
    if (descriptionAr) category.description.ar = descriptionAr;
    if (imageFromFile) category.image = imageFromFile;
    else if (imageFromBody) category.image = imageFromBody;

    const updated = await category.save();
    const newNameEn = updated.name.en;

    // Handle translations in files
    try {
      // Check if the category key (English name) has changed
      const categoryKeyChanged = oldNameEn.toLowerCase() !== newNameEn?.toLowerCase();

      if (categoryKeyChanged && newNameEn) {
        // If the category key changed, rename in translation files
        console.log(`🔄 Category key changed from "${oldNameEn}" to "${newNameEn}"`);
        
        await translationService.renameCategoryKey(
          oldNameEn,
          newNameEn,
          { en: updated.name.en, ar: updated.name.ar },
          { en: updated.description.en, ar: updated.description.ar }
        );
      } else {
        // If only the display names changed, update in place
        console.log(`📝 Updating category translations for "${oldNameEn}"`);
        
        await translationService.updateCategoryTranslation(
          oldNameEn,
          { en: updated.name.en, ar: updated.name.ar },
          { en: updated.description.en, ar: updated.description.ar }
        );
      }

      console.log('✅ Translation updated successfully');
    } catch (translationError) {
      console.error('⚠️ Translation update failed:', translationError);
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error('❌ Update category error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    
    // Find and delete category by English name
    const deleted = await Category.findOneAndDelete({ 
      "name.en": categoryName 
    });

    if (!deleted) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Remove from translation files
    console.log('🔄 Removing category translation for:', categoryName);
    try {
      await translationService.removeCategoryTranslation(deleted.name.en);
      console.log('✅ Translation removed successfully');
    } catch (translationError) {
      console.error('⚠️ Translation removal failed:', translationError);
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error('❌ Delete category error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};

export const getCategoryByName = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { categoryName } = req.params;
    const language = req.query.language as 'en' | 'ar' || 'en';
    
    // Find category by English name
    const category = await Category.findOne({ 
      "name.en": categoryName 
    });

    if (!category) {
      res.status(404).json({ message: "Category not found" });
      return;
    }

    // Add display fields for convenience
    const categoryWithDisplay = {
      ...category.toObject(),
      displayName: category.name[language] || category.name.en,
      displayDescription: category.description[language] || category.description.en
    };

    res.status(200).json(categoryWithDisplay);
  } catch (err) {
    console.error('❌ Get category error:', err);
    res.status(500).json({ message: (err as Error).message });
  }
};
export const getItemsWithSearch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    
    // Extract and validate query parameters
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    const language = (typeof req.query.language === 'string' && (req.query.language === 'en' || req.query.language === 'ar')) 
      ? req.query.language as 'en' | 'ar' 
      : 'en';
    
    console.log('🚀 === SEARCH DEBUG START ===');
    console.log('📥 Query params:', { search, category, role, language, skip, limit });
    
    // Arabic text normalization function
    const normalizeArabicText = (text: string): string => {
      if (!text) return text;
      
      return text
        // Normalize different forms of Alef
        .replace(/[آأإا]/g, 'ا')
        // Normalize different forms of Hamza
        .replace(/[ؤئء]/g, 'ء')
        // Normalize different forms of Yaa
        .replace(/[يى]/g, 'ي')
        // Normalize different forms of Haa
        .replace(/[هة]/g, 'ه')
        // Remove diacritics/tashkeel
        .replace(/[ًٌٍَُِّْٰ]/g, '')
        // Normalize Taa Marbouta
        .replace(/ة/g, 'ه');
    };

    // Enhanced search matching that works across languages
    const createSearchMatch = (searchTerm: string) => {
      if (!searchTerm || !searchTerm.trim()) return null;
      
      const trimmedTerm = searchTerm.trim();
      const normalizedArabicTerm = normalizeArabicText(trimmedTerm);
      
      // Create multiple search patterns
      const searchPatterns = [];
      
      // Original term (case-insensitive)
      searchPatterns.push(new RegExp(trimmedTerm, 'i'));
      
      // If the term contains Arabic, add normalized version
      if (/[\u0600-\u06FF]/.test(trimmedTerm)) {
        searchPatterns.push(new RegExp(normalizedArabicTerm, 'i'));
      }
      
      // Create the match conditions for both languages
      const matchConditions = [];
      
      searchPatterns.forEach(pattern => {
        // Search in English names
        matchConditions.push({ 'items.name.en': pattern });
        // Search in Arabic names
        matchConditions.push({ 'items.name.ar': pattern });
        
        // Also search in normalized Arabic text using $function for more complex normalization
        matchConditions.push({
          $expr: {
            $regexMatch: {
              input: {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: {
                        $replaceAll: {
                          input: {
                            $replaceAll: {
                              input: {
                                $replaceAll: {
                                  input: '$items.name.ar',
                                  find: 'آ',
                                  replacement: 'ا'
                                }
                              },
                              find: 'أ',
                              replacement: 'ا'
                            }
                          },
                          find: 'إ',
                          replacement: 'ا'
                        }
                      },
                      find: 'ة',
                      replacement: 'ه'
                    }
                  },
                  find: 'ى',
                  replacement: 'ي'
                }
              },
              regex: normalizedArabicTerm,
              options: 'i'
            }
          }
        });
      });
      
      return { $or: matchConditions };
    };
    
    // Build aggregation pipeline step by step
    const pipeline: any[] = [];
    
    // Step 1: Match categories if category filter is applied (BEFORE unwind)
    if (category && category !== 'all') {
      const categoryRegex = new RegExp(category.trim(), 'i');
      const categoryMatch = {
        $or: [
          { 'name.en': categoryRegex },
          { 'name.ar': categoryRegex }
        ]
      };
      pipeline.push({ $match: categoryMatch });
      console.log('🔍 Added category filter:', categoryMatch);
    }
    
    // Step 2: Unwind the items array to work with individual items
    pipeline.push({ $unwind: '$items' });
    console.log('🔍 Added $unwind stage');
    
    // Step 3: Enhanced search matching (AFTER unwind)
    if (search && search.trim()) {
      const searchMatch = createSearchMatch(search);
      if (searchMatch) {
        pipeline.push({ $match: searchMatch });
        console.log('🔍 Added enhanced search filter');
        console.log('🔍 Searching for term:', search.trim());
        console.log('🔍 Normalized Arabic term:', normalizeArabicText(search.trim()));
      }
    }
    
    // Step 4: Add category info to each item
    pipeline.push({
      $addFields: {
        'items.categoryName': '$name',
        'items.categoryId': '$_id'
      }
    });
    
    // Step 5: Replace root with item data
    pipeline.push({ $replaceRoot: { newRoot: '$items' } });
    
    // Step 6: Add display names and normalized versions
    pipeline.push({
      $addFields: {
        displayName: { $ifNull: [`$name.${language}`, '$name.en'] },
        displayCategoryName: { $ifNull: [`$categoryName.${language}`, '$categoryName.en'] },
        // Add normalized Arabic names for better sorting/matching
        normalizedArabicName: {
          $replaceAll: {
            input: {
              $replaceAll: {
                input: {
                  $replaceAll: {
                    input: {
                      $replaceAll: {
                        input: {
                          $replaceAll: {
                            input: '$name.ar',
                            find: 'آ',
                            replacement: 'ا'
                          }
                        },
                        find: 'أ',
                        replacement: 'ا'
                      }
                    },
                    find: 'إ',
                    replacement: 'ا'
                  }
                },
                find: 'ة',
                replacement: 'ه'
              }
            },
            find: 'ى',
            replacement: 'ي'
          }
        }
      }
    });
    
    // Step 7: Add price modification for buyers
    if (role === 'buyer') {
      pipeline.push({
        $addFields: {
          price: {
            $round: [{ $multiply: ['$price', 1.5] }, 2]
          }
        }
      });
      console.log('🔍 Added buyer price modification');
    }
    
    // Step 8: Sort for consistent results (prioritize exact matches)
    if (search && search.trim()) {
      // Sort with search relevance - exact matches first
      const searchTerm = search.trim().toLowerCase();
      pipeline.push({
        $addFields: {
          searchScore: {
            $add: [
              // Exact match in English gets highest score
              {
                $cond: [
                  { $eq: [{ $toLower: '$name.en' }, searchTerm] },
                  100,
                  0
                ]
              },
              // Exact match in Arabic gets highest score
              {
                $cond: [
                  { $eq: [{ $toLower: '$name.ar' }, searchTerm] },
                  100,
                  0
                ]
              },
              // Starts with match gets medium score
              {
                $cond: [
                  {
                    $or: [
                      { $regexMatch: { input: '$name.en', regex: `^${searchTerm}`, options: 'i' } },
                      { $regexMatch: { input: '$name.ar', regex: `^${searchTerm}`, options: 'i' } }
                    ]
                  },
                  50,
                  0
                ]
              },
              // Contains match gets low score
              10
            ]
          }
        }
      });
      
      pipeline.push({
        $sort: { searchScore: -1, 'name.en': 1 }
      });
    } else {
      pipeline.push({
        $sort: { 'name.en': 1 }
      });
    }
    
    console.log('📋 Final pipeline stages:', pipeline.length);
    
    // Execute aggregation - first get total count
    const countPipeline = [...pipeline];
    // Remove sort and addFields for searchScore from count pipeline for efficiency
    const cleanCountPipeline = countPipeline.filter(stage => 
      !stage.$sort && 
      !stage.$addFields?.searchScore
    );
    cleanCountPipeline.push({ $count: 'total' });
    
    const totalCountResult = await Category.aggregate(cleanCountPipeline);
    const total = totalCountResult[0]?.total || 0;
    
    console.log('📊 Total items found before pagination:', total);
    
    // If no results found and we have search/category filters, log it
    if (total === 0 && (search || (category && category !== 'all'))) {
      console.log('❌ No results found for search/category filter');
      console.log('🔍 Search term:', search);
      console.log('🔍 Normalized search term:', search ? normalizeArabicText(search.trim()) : 'N/A');
      console.log('🔍 Category:', category);
    }
    
    // Then get paginated results
    const resultPipeline = [
      ...pipeline,
      { $skip: skip },
      { $limit: limit }
    ];
    
    const items = await Category.aggregate(resultPipeline);
    
    console.log('📦 Items returned after pagination:', items.length);
    if (items.length > 0) {
      console.log('📦 First few items:', items.slice(0, 2).map(item => ({
        name: item.name,
        displayName: item.displayName,
        searchScore: item.searchScore || 0
      })));
    }
    
    console.log('✅ === SEARCH DEBUG END ===');
    
    // Remove searchScore from final results for cleaner output
    const cleanItems = items.map(item => {
      const { searchScore, normalizedArabicName, ...cleanItem } = item;
      return cleanItem;
    });
    
    res.json({
      success: true,
      data: cleanItems,
      pagination: {
        currentPage: req.pagination.page,
        itemsPerPage: req.pagination.limit,
        totalItems: total,
        totalPages: Math.ceil(total / req.pagination.limit),
        hasNextPage: req.pagination.skip + req.pagination.limit < total,
        hasPreviousPage: req.pagination.skip > 0
      },
      // Add debug info in development
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          searchTerm: search,
          normalizedSearchTerm: search ? normalizeArabicText(search.toString().trim()) : null,
          category,
          pipelineStages: pipeline.length,
          totalBeforePagination: total
        }
      })
    });
  } catch (error) {
    console.error('❌ Get items with search error:', error);
    res.status(500).json({ 
      success: false, 
      error: "Server error",
      message: (error as Error).message 
    });
  }
};

// NEW: Get all unique category names for filter dropdown
export const getCategoryNames = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const language = req.query.language as 'en' | 'ar' || 'en';
    
    const categories = await Category.find()
      .select('name')
      .lean();
    
    // Extract category names based on language preference
    const categoryNames = categories.map(cat => 
      cat.name[language] || cat.name.en
    ).filter(Boolean);
    
    // Remove duplicates and sort
    const uniqueNames = [...new Set(categoryNames)].sort();
    
    res.json({
      success: true,
      data: uniqueNames
    });
  } catch (error) {
    console.error('❌ Get category names error:', error);
    res.status(500).json({ 
      success: false,
      error: "Server error" 
    });
  }
};

// NEW: Search suggestions endpoint (optional - for autocomplete)
export const getSearchSuggestions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query } = req.query;
    const language = req.query.language as 'en' | 'ar' || 'en';
    
    if (!query || (query as string).length < 2) {
      res.json({ success: true, data: [] });
      return;
    }
    
    const searchRegex = new RegExp(query as string, 'i');
    
    const suggestions = await Category.aggregate([
      { $unwind: '$items' },
      {
        $match: {
          $or: [
            { [`items.name.${language}`]: searchRegex },
            { [`items.name.en`]: searchRegex }, // Fallback to English
            { [`name.${language}`]: searchRegex },
            { [`name.en`]: searchRegex }
          ]
        }
      },
      {
        $group: {
          _id: null,
          itemNames: { $addToSet: `$items.name.${language}` },
          categoryNames: { $addToSet: `$name.${language}` }
        }
      },
      {
        $project: {
          _id: 0,
          suggestions: {
            $slice: [
              { $setUnion: ['$itemNames', '$categoryNames'] },
              10 // Limit to 10 suggestions
            ]
          }
        }
      }
    ]);
    
    const results = suggestions[0]?.suggestions || [];
    
    res.json({
      success: true,
      data: results.filter(Boolean) // Remove null/undefined values
    });
  } catch (error) {
    console.error('❌ Get search suggestions error:', error);
    res.status(500).json({ 
      success: false,
      error: "Server error" 
    });
  }
};

export const getCategoriesWithSearch = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const language = (typeof req.query.language === 'string' && (req.query.language === 'en' || req.query.language === 'ar')) 
      ? req.query.language as 'en' | 'ar' 
      : 'en';

    console.log('🔍 === CATEGORY SEARCH DEBUG START ===');
    console.log('📥 Query params:', { search, language, skip, limit, page: req.pagination.page });

    // Build search query - SIMPLIFIED VERSION
    let searchQuery: any = {};
    
    if (search && search.length > 0) {
      console.log('🔍 Building search query for term:', search);
      
      // Create simple regex for case-insensitive search
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); // Escape special regex characters
      
      // Simple search conditions - test one by one
      const searchConditions = [
        // Direct text search in category names
        { 'name.en': { $regex: searchRegex } },
        { 'name.ar': { $regex: searchRegex } },
        
        // // Direct text search in category descriptions
        // { 'description.en': { $regex: searchRegex } },
        // { 'description.ar': { $regex: searchRegex } },
        
        // // Search in items within categories
        // { 'items.name.en': { $regex: searchRegex } },
        // { 'items.name.ar': { $regex: searchRegex } }
      ];

      searchQuery = { $or: searchConditions };
      
      console.log('🔍 Final search query:', JSON.stringify(searchQuery, null, 2));
    } else {
      console.log('🔍 No search term provided, fetching all categories');
    }

    // DEBUGGING: Let's first check what we get without pagination
    console.log('📊 Testing search query without pagination...');
    const testResults = await Category.find(searchQuery).lean().limit(50);
    console.log('📊 Test results count:', testResults.length);
    console.log('📊 First few test results:', testResults.slice(0, 2).map(cat => ({
      id: cat._id,
      nameEn: cat.name?.en,
      nameAr: cat.name?.ar,
      itemsCount: cat.items?.length || 0
    })));

    // Execute search with pagination
    const [categories, total] = await Promise.all([
      Category.find(searchQuery)
        .skip(skip)
        .limit(limit)
        .lean()
        .sort({ 'name.en': 1 }),
      Category.countDocuments(searchQuery),
    ]);

    console.log('📊 Paginated results count:', categories.length);
    console.log('📊 Total matching documents:', total);
    console.log('📊 Should return empty for "paper" if no matches');

    // If we have a search term but got all categories, something is wrong
    if (search && total > 0) {
      console.log('📊 Sample of returned categories:');
      categories.slice(0, 3).forEach((cat, index) => {
        console.log(`📊 Category ${index + 1}:`, {
          id: cat._id,
          nameEn: cat.name?.en,
          nameAr: cat.name?.ar,
          descEn: cat.description?.en?.substring(0, 50),
          itemsCount: cat.items?.length || 0,
          hasMatchingItems: cat.items?.some((item: any) => 
            item?.name?.en?.toLowerCase().includes(search.toLowerCase()) ||
            item?.name?.ar?.toLowerCase().includes(search.toLowerCase())
          )
        });
      });
    }

    // Transform categories with language-specific display names
    const transformedCategories = categories.map(category => {
      // Filter items that match search if searching
      let filteredItems = category.items || [];
      
      if (search) {
        const itemSearchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filteredItems = category.items?.filter((item: any) => 
          (item?.name?.en && itemSearchRegex.test(item.name.en)) || 
          (item?.name?.ar && itemSearchRegex.test(item.name.ar))
        ) || [];
      }

      return {
        ...category,
        displayName: category.name[language] || category.name.en,
        displayDescription: category.description[language] || category.description.en,
        items: filteredItems.map((item: any) => ({
          ...item,
          displayName: item?.name?.[language] || item?.name?.en || item?.name || '',
        })),
      };
    });

    const totalPages = Math.ceil(total / req.pagination.limit);
    const hasNextPage = req.pagination.page < totalPages;
    const hasPreviousPage = req.pagination.page > 1;

    console.log('📊 Final response summary:', {
      searchTerm: search,
      categoriesReturned: transformedCategories.length,
      totalMatching: total,
      currentPage: req.pagination.page,
      totalPages
    });

    console.log('✅ === CATEGORY SEARCH DEBUG END ===');

    // If search term is provided but we're returning all categories, log a warning
    if (search && total > 10) {
      console.warn('⚠️  WARNING: Search term provided but many results returned. Check if search is working correctly.');
    }

    res.json({
      success: true,
      data: transformedCategories,
      pagination: {
        currentPage: req.pagination.page,
        itemsPerPage: req.pagination.limit,
        totalItems: total,
        totalPages: totalPages,
        hasNextPage: hasNextPage,
        hasPreviousPage: hasPreviousPage,
      },
      searchInfo: {
        searchTerm: search,
        hasSearch: Boolean(search),
        resultsCount: total,
        currentPageResults: categories.length
      },
      debug: {
        queryUsed: searchQuery,
        testResultsCount: testResults.length,
        expectedBehavior: search ? `Should return only categories matching "${search}"` : 'Should return all categories'
      }
    });
  } catch (error) {
    console.error('❌ Get categories with search error:', error);
    res.status(500).json({ 
      success: false,
      error: "Server error", 
      message: (error as Error).message 
    });
  }
};

// Alternative simpler version - use this if the above still doesn't work
export const getCategoriesWithSearchSimple = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination;
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const language = (typeof req.query.language === 'string' && (req.query.language === 'en' || req.query.language === 'ar')) 
      ? req.query.language as 'en' | 'ar' 
      : 'en';

    let filter: any = {};
    
    // VERY SIMPLE SEARCH - test this first
    if (search) {
      filter = {
        $or: [
          { 'name.en': new RegExp(search, 'i') },
          { 'name.ar': new RegExp(search, 'i') }
        ]
      };
    }

    console.log('Simple search filter:', JSON.stringify(filter, null, 2));

    const [categories, total] = await Promise.all([
      Category.find(filter).skip(skip).limit(limit).lean(),
      Category.countDocuments(filter),
    ]);

    console.log(`Simple search: Found ${total} categories matching "${search}"`);

    res.json({
      success: true,
      data: categories.map(cat => ({
        ...cat,
        displayName: cat.name[language] || cat.name.en,
        displayDescription: cat.description[language] || cat.description.en,
      })),
      pagination: {
        currentPage: req.pagination.page,
        itemsPerPage: req.pagination.limit,
        totalItems: total,
        totalPages: Math.ceil(total / req.pagination.limit),
        hasNextPage: req.pagination.page < Math.ceil(total / req.pagination.limit),
        hasPreviousPage: req.pagination.page > 1,
      }
    });
  } catch (error) {
    console.error('Simple search error:', error);
    res.status(500).json({ 
      success: false,
      error: "Server error", 
      message: (error as Error).message 
    });
  }
};


// Update your existing getCategoriesWithPagination to support search
export const getCategoriesWithPaginationUpdated = async (
  req: Request,
  res: Response
) => {
  try {
    const role = req.query.role;
    const language = req.query.language as 'en' | 'ar' || 'en';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    
    // If there's a search term, use the search-specific method
    if (search) {
      return getCategoriesWithSearch(req, res);
    }
    
    // Otherwise, use the existing pagination logic
    const [categories, total] = await Promise.all([
      Category.find().skip(req.pagination.skip).limit(req.pagination.limit).lean(),
      Category.countDocuments(),
    ]);

    // Transform categories with language-specific display
    const transformedCategories = categories.map(category => {
      return {
        ...category,
        displayName: category.name[language] || category.name.en,
        displayDescription: category.description[language] || category.description.en,
        items: Array.isArray(category.items)
          ? category.items.map((item: any) => ({
              ...item,
              displayName: item.name?.[language] || item.name?.en || item.name,
              price: role === "buyer" && item.price 
                ? Math.round(item.price * 1.5 * 100) / 100 
                : item.price
            }))
          : [],
      };
    });

    res.json({
      success: true,
      data: transformedCategories,
      pagination: {
        currentPage: req.pagination.page,
        itemsPerPage: req.pagination.limit,
        totalItems: total,
        totalPages: Math.ceil(total / req.pagination.limit),
        hasNextPage: req.pagination.skip + req.pagination.limit < total,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};