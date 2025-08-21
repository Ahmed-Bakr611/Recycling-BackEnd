import { Request, Response } from "express";
import Category from "../models/category";
// 1. Get items index to highlight available characters
export const getItemsIndex = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const language = (req.query.lang as "en" | "ar") || "en";
    const role = req.query.role;

    // Get all items with basic info for indexing
    const items = (await Category.aggregate([
      { $unwind: "$items" },
      {
        $project: {
          _id: "$items._id",
          name: "$items.name",
          image: "$items.image",
          categoryName: "$name",
          categoryId: "$_id",
          createdAt: "$items.createdAt",
        },
      },
      // Sort by name in the selected language
      { $sort: { [`name.${language}`]: 1 } },
    ])) as Array<Record<string, any>>;

    // Transform items with language-specific display names
    const transformedItems = items.map((item) => ({
      _id: item._id,
      name: {
        en: item.name?.en || item.name,
        ar: item.name?.ar || item.name,
      },
      image: item.image,
      categoryName: {
        en: item.categoryName?.en || item.categoryName,
        ar: item.categoryName?.ar || item.categoryName,
      },
      displayName: item.name?.[language] || item.name?.en || item.name,
      categoryDisplayName:
        item.categoryName?.[language] ||
        item.categoryName?.en ||
        item.categoryName,
    }));

    // Generate alphabet statistics for highlighting
    const alphabetStats = getAlphabetStats(transformedItems, language);

    res.status(200).json({
      success: true,
      data: transformedItems,
      meta: {
        total: transformedItems.length,
        language,
        alphabetStats,
      },
    });
  } catch (err) {
    console.error("getItemsIndex error:", err);
    res.status(500).json({
      success: false,
      message: (err as Error).message,
    });
  }
};

// 2. Search items based on query
export const searchItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { skip, limit } = req.pagination || { skip: 0, limit: 10 };
    const query = req.query.q as string;
    const language = (req.query.lang as "en" | "ar") || "en";
    const role = req.query.role;
    const categoryName = req.query.category as string;

    console.log("🔍 Incoming search request:", {
      query,
      searchLang: language,
      role,
      categoryName,
      skip,
      limit,
    });

    if (!query || query.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: "Search query is required",
      });
      return;
    }

    const searchQuery = query.trim();
    let matchStage: any = {};

    // Category filter
    if (categoryName && categoryName !== "all") {
      matchStage[`name.${language}`] = categoryName;
    }

    // Build search conditions
    let itemsMatchConditions: any = {};

    if (searchQuery.length === 1) {
      const letterRegex = new RegExp(`^${searchQuery}.*`);
      itemsMatchConditions[`items.name.${language}`] = letterRegex;

      console.log("🔡 Single-char search regex:", letterRegex);
    } else {
      itemsMatchConditions = {
        $or: [
          {
            [`items.name.${language}`]: {
              $regex: searchQuery,
              $options: "i",
            },
          },
          {
            [`items.name.${language === "ar" ? "en" : "ar"}`]: {
              $regex: searchQuery,
              $options: "i",
            },
          },
          { [`name.${language}`]: { $regex: searchQuery, $options: "i" } },
          {
            [`name.${language === "ar" ? "en" : "ar"}`]: {
              $regex: searchQuery,
              $options: "i",
            },
          },
        ],
      };

      console.log("🔡 Multi-char search conditions:", itemsMatchConditions);
    }

    console.log("📦 Match stage:", matchStage);

    // Get total count
    const totalAggregation = await Category.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      { $match: itemsMatchConditions },
      { $count: "total" },
    ]);

    const totalItems = totalAggregation[0]?.total || 0;

    console.log("📊 Total matched items:", totalItems);

    // Get paginated search results
    const items = (await Category.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      { $match: itemsMatchConditions },
      { $sort: { [`items.name.${language}`]: 1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: "$items._id",
          name: "$items.name",
          points: "$items.points",
          price: "$items.price",
          measurement_unit: "$items.measurement_unit",
          image: "$items.image",
          quantity: "$items.quantity",
          categoryName: "$name",
          categoryId: "$_id",
          createdAt: "$items.createdAt",
        },
      },
    ])) as Array<Record<string, any>>;

    console.log("📦 Items returned:", items.length);

    // Transform items
    const transformedItems = items.map((item) => {
      const result: any = {
        _id: item._id,
        name: {
          en: item.name?.en || item.name,
          ar: item.name?.ar || item.name,
        },
        image: item.image,
        categoryName: {
          en: item.categoryName?.en || item.categoryName,
          ar: item.categoryName?.ar || item.categoryName,
        },
        displayName: item.name?.[language] || item.name?.en || item.name,
        categoryDisplayName:
          item.categoryName?.[language] ||
          item.categoryName?.en ||
          item.categoryName,
        points: item.points,
        price: item.price,
        measurement_unit: item.measurement_unit,
        quantity: item.quantity,
        categoryId: item.categoryId,
        createdAt: item.createdAt,
      };

      if (role === "buyer" && item.price) {
        result.price = Math.round(item.price * 1.5 * 100) / 100;
      }
      return result;
    });

    console.log("✅ Transformed items sample:", transformedItems[0]);

    // Pagination info
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = Math.floor(skip / limit) + 1;

    res.status(200).json({
      success: true,
      data: transformedItems,
      meta: {
        query: searchQuery,
        language,
        pagination: {
          currentPage,
          totalPages,
          totalItems,
          itemsPerPage: limit,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        },
      },
    });
  } catch (err) {
    console.error("❌ searchItems error:", err);
    res.status(500).json({
      success: false,
      message: (err as Error).message,
    });
  }
};

// Helper function to get alphabet statistics
function getAlphabetStats(items: any[], language: "en" | "ar" = "en") {
  const stats: Record<string, number> = {};

  // Get appropriate alphabet
  const alphabet =
    language === "ar"
      ? [
          "أ",
          "ب",
          "ت",
          "ث",
          "ج",
          "ح",
          "خ",
          "د",
          "ذ",
          "ر",
          "ز",
          "س",
          "ش",
          "ص",
          "ض",
          "ط",
          "ظ",
          "ع",
          "غ",
          "ف",
          "ق",
          "ك",
          "ل",
          "م",
          "ن",
          "ه",
          "و",
          "ي",
        ]
      : Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  // Initialize all letters with 0
  alphabet.forEach((letter) => {
    stats[letter] = 0;
  });

  // Count items for each letter
  items.forEach((item) => {
    const name = item.displayName || item.name?.[language] || "";
    if (name) {
      const firstChar = name.charAt(0).toUpperCase();
      if (stats.hasOwnProperty(firstChar)) {
        stats[firstChar]++;
      }
    }
  });

  return {
    alphabet,
    counts: stats,
    availableLetters: Object.keys(stats).filter((letter) => stats[letter] > 0),
  };
}
