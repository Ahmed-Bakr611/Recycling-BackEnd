// controllers/deliveryController.ts
import { Request, Response } from "express";
import User from "../models/users";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import mongoose from "mongoose";
import Order from "../models/pickupOrder";
import { client } from "./auth";

export const registerDeliveryUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phoneNumber, provider, idToken } = req.body;

    const attachmentsFromBody = JSON.parse(req.body.attachments || "{}");

    const files = req.files as Record<string, Express.Multer.File[]>;
    let user = null;
    const attachments = {
      ...attachmentsFromBody,
      deliveryImage: files?.deliveryImage?.[0]?.path || null,
      vehicleImage: files?.vehicleImage?.[0]?.path || null,
      criminalRecord: files?.criminalRecord?.[0]?.path || null,
    };

    if (provider === "google") {
      if (!idToken) {
        return res.status(400).json({ message: "Google ID token is required" });
      }

      const ticket = await client.verifyIdToken({
        idToken,
        audience: [
          process.env.GOOGLE_WEB_CLIENT_ID,
          process.env.GOOGLE_MOBILE_CLIENT_ID,
          process.env.GOOGLE_MOBILE_WEB_CLIENT_ID,
        ],
      });

      const payload = ticket.getPayload();

      if (!payload?.email) {
        return res.status(400).json({ message: "Invalid Google token" });
      }

      // Check if user already exists
      user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: name,
          email: payload.email,
          provider: "google",
          phoneNumber: phoneNumber?.padStart(11, "0") || "",
          role: "delivery",
          attachments,
          isApproved: false,
        });
      }
    } else {
      user = await User.create({
        name,
        email,
        password,
        phoneNumber: phoneNumber?.padStart(11, "0"),
        provider: provider,
        role: "delivery",
        attachments,
        isApproved: false, // for admin approval
      });
    }

    const accessToken = generateAccessToken(user._id.toString(), user.role);
    const refreshToken = generateRefreshToken(user._id.toString(), user.role);

    return res
      .status(201)
      .cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      })
      .header("Authorization", `Bearer ${accessToken}`)
      .json({ accessToken, user });
  } catch (err) {
    console.error("Register delivery error:", err);
    return res
      .status(500)
      .json({ message: err.message || "Delivery registration failed" });
  }
};
export const getAllDeliveries = async (req: Request, res: Response) => {
  try {
    const deliveries = await User.find({ role: "delivery" }).select(
      "name email phoneNumber isApproved attachments createdAt rating totalReviews" // Include rating fields
    );

    return res.status(200).json({
      success: true,
      deliveries: deliveries, // Make sure this matches your frontend expectation
    });
  } catch (err) {
    console.error("Get deliveries error:", err);
    return res.status(500).json({ message: "Failed to fetch delivery users" });
  }
};

// If you have a separate getDeliveryAttachments function, update it like this:
export const getDeliveryAttachments = async (req: Request, res: Response) => {
  try {
    console.log("📊 Fetching delivery attachments with rating data...");

    // Get all delivery users with their rating information
    const deliveries = await User.find({ role: "delivery" }).select(
      "name email phoneNumber isApproved attachments createdAt rating totalReviews"
    );

    console.log(`📋 Found ${deliveries.length} delivery users`);

    // Transform the data to include all needed fields
    const transformedData = deliveries.map((delivery) => {
      const deliveryObj = delivery.toObject();

      // Determine current status based on attachments or approval status
      let currentStatus = "pending";

      if (deliveryObj.attachments?.status) {
        currentStatus = deliveryObj.attachments.status;
      } else if (deliveryObj.attachments?.revokedAt) {
        currentStatus = "revoked";
      } else if (deliveryObj.attachments?.declinedAt) {
        currentStatus = "declined";
      } else if (deliveryObj.isApproved) {
        currentStatus = "approved";
      }

      const result = {
        userId: deliveryObj._id,
        name: deliveryObj.name,
        email: deliveryObj.email,
        phoneNumber: deliveryObj.phoneNumber,
        isApproved: deliveryObj.isApproved,
        currentStatus: currentStatus,
        attachments: deliveryObj.attachments,
        createdAt: deliveryObj.createdAt,

        // ✅ Add rating data - This was missing!
        rating: deliveryObj.rating || 0,
        totalReviews: deliveryObj.totalReviews || 0,

        // Add canReapply logic
        canReapply: currentStatus === "declined" || currentStatus === "revoked",
      };

      console.log(
        `👤 User ${deliveryObj.name}: rating=${result.rating}, reviews=${result.totalReviews}`
      );

      return result;
    });

    console.log("✅ Transformed data with rating fields");

    return res.status(200).json({
      success: true,
      data: transformedData, // Make sure to use 'data' key to match your frontend
    });
  } catch (err) {
    console.error("❌ Get delivery attachments error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch delivery attachments",
    });
  }
};
export const getDeliveryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id, role: "delivery" }).select(
      "name email phoneNumber isApproved attachments createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "Delivery user not found" });
    }

    return res.status(200).json({ delivery: user });
  } catch (err) {
    console.error("Get delivery by ID error:", err);
    return res.status(500).json({ message: "Failed to fetch delivery user" });
  }
};
export const approveDeliveryUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { isApproved },
      { new: true }
    ).select("name email isApproved");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Approval status updated", user });
  } catch (err) {
    console.error("Update approval error:", err);
    return res
      .status(500)
      .json({ message: "Failed to update approval status" });
  }
};
export const updateDelivery = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await User.findOneAndUpdate(
      { _id: id, role: "delivery" },
      updates,
      { new: true }
    ).select("name email phoneNumber isApproved attachments");

    if (!user) {
      return res.status(404).json({ message: "Delivery user not found" });
    }

    return res.status(200).json({ message: "Delivery user updated", user });
  } catch (err) {
    console.error("Update delivery error:", err);
    return res.status(500).json({ message: "Failed to update delivery user" });
  }
};
interface DeliveryReview {
  stars: number;
  comment: string;
  reviewedAt: Date;
  reviewedBy: mongoose.Types.ObjectId;
}
export const submitDeliveryReview = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { rating, comments } = req.body; // Changed to match your frontend
    const userId = req.user?.userId;

    console.log("📝 Submitting delivery review...");
    console.log("Order ID:", orderId);
    console.log("User ID:", userId);
    console.log("Rating:", rating);
    console.log("Comments:", comments);

    // Validation
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid or missing order ID" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized - user not found" });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: "Rating is required and must be between 1 and 5",
      });
    }

    // Comments are optional, but if provided, validate length
    if (comments && comments.length > 1000) {
      return res.status(400).json({
        message: "Comments are too long (max 1000 characters)",
      });
    }

    // Find the order and populate courier data
    const order = await Order.findById(orderId)
      .populate("user.userId", "name email")
      .populate("courier", "name email");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if user is authorized to review this order
    if (order.user.userId._id.toString() !== userId) {
      return res.status(403).json({
        message: "You are not authorized to review this order",
      });
    }

    // Check if order is completed
    if (order.status.toLowerCase() !== "completed") {
      return res.status(400).json({
        message: "Can only review completed orders",
      });
    }

    // Check if courier exists and is populated
    if (!order.courier) {
      return res.status(400).json({
        message: "No courier assigned to this order",
      });
    }

    // Type assertion to handle populated courier
    const populatedCourier = order.courier as any;

    // Check if review already exists
    if (order.deliveryReview) {
      return res.status(409).json({
        message: "Review has already been submitted for this order",
      });
    }

    // Create the review
    const deliveryReview: DeliveryReview = {
      stars: parseInt(rating),
      comment: comments ? comments.trim() : "", // Comments are optional
      reviewedAt: new Date(),
      reviewedBy: new mongoose.Types.ObjectId(userId),
    };

    // Add review to order
    order.deliveryReview = deliveryReview;
    await order.save();

    // Update courier's rating statistics
    await updateCourierRating(
      populatedCourier._id.toString(),
      parseInt(rating)
    );

    console.log("✅ Delivery review submitted successfully");

    res.status(201).json({
      success: true,
      message: "Delivery review submitted successfully",
      review: {
        orderId: order._id,
        rating: deliveryReview.stars, // Changed to match frontend
        comments: deliveryReview.comment, // Changed to match frontend
        reviewedAt: deliveryReview.reviewedAt,
        courier: {
          id: populatedCourier._id,
          name: populatedCourier.name,
        },
      },
    });
  } catch (error) {
    console.error("❌ Submit delivery review error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get delivery review for a specific order
export const getDeliveryReview = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.userId;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid or missing order ID" });
    }

    const order = await Order.findById(orderId)
      .populate("user.userId", "name email")
      .populate("courier", "name email")
      .select("deliveryReview user courier status");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if user is authorized to view this review
    if (order.user.userId._id.toString() !== userId) {
      return res.status(403).json({
        message: "You are not authorized to view this review",
      });
    }

    if (!order.deliveryReview) {
      return res.status(404).json({
        message: "No review found for this order",
      });
    }

    // Type assertion to handle populated courier
    const populatedCourier = order.courier as any;

    res.status(200).json({
      success: true,
      review: {
        orderId: order._id,
        stars: order.deliveryReview.stars,
        comment: order.deliveryReview.comment,
        reviewedAt: order.deliveryReview.reviewedAt,
        courier: {
          id: populatedCourier._id,
          name: populatedCourier.name,
        },
        canEdit: true, // User can edit their own review
      },
    });
  } catch (error) {
    console.error("❌ Get delivery review error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update/Edit a delivery review
export const updateDeliveryReview = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { rating, comments } = req.body; // ✅ Changed from stars, comment to rating, comments
    const userId = req.user?.userId;

    console.log("✏️ Updating delivery review...");
    console.log("Order ID:", orderId);
    console.log("User ID:", userId);

    // Validation
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid or missing order ID" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized - user not found" });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        message: "Rating must be between 1 and 5",
      });
    }

    if (comments && comments.length > 1000) {
      return res.status(400).json({
        message: "Comments are too long (max 1000 characters)",
      });
    }

    // Find the order and populate courier data
    const order = await Order.findById(orderId)
      .populate("user.userId", "name email")
      .populate("courier", "name email");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check authorization
    if (order.user.userId._id.toString() !== userId) {
      return res.status(403).json({
        message: "You are not authorized to update this review",
      });
    }

    // Check if review exists
    if (!order.deliveryReview) {
      return res.status(404).json({
        message: "No review found to update",
      });
    }

    const oldRating = order.deliveryReview.stars; // Store old rating for courier update

    // Update review fields - map API names to database schema
    if (rating) {
      order.deliveryReview.stars = parseInt(rating);
    }
    if (comments !== undefined) {
      // Allow empty string to clear comments
      order.deliveryReview.comment = comments.trim();
    }

    await order.save();

    // Type assertion to handle populated courier
    const populatedCourier = order.courier as any;

    // Update courier rating if rating changed
    if (rating && oldRating !== parseInt(rating)) {
      await updateCourierRatingOnEdit(
        populatedCourier._id.toString(),
        oldRating,
        parseInt(rating)
      );
    }

    console.log("✅ Delivery review updated successfully");

    res.status(200).json({
      success: true,
      message: "Delivery review updated successfully",
      review: {
        orderId: order._id,
        rating: order.deliveryReview.stars, // Map back to consistent API naming
        comments: order.deliveryReview.comment, // Map back to consistent API naming
        reviewedAt: order.deliveryReview.reviewedAt,
        courier: {
          id: populatedCourier._id,
          name: populatedCourier.name,
        },
      },
    });
  } catch (error) {
    console.error("❌ Update delivery review error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all reviews for a specific courier (for courier profile)
export const getCourierReviews = async (req: Request, res: Response) => {
  try {
    const { courierId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    if (!courierId || !mongoose.Types.ObjectId.isValid(courierId)) {
      return res.status(400).json({ message: "Invalid courier ID" });
    }

    // Get orders with reviews for this courier
    // More specific query to ensure deliveryReview has the required fields
    const orders = await Order.find({
      courier: courierId,
      deliveryReview: {
        $exists: true,
        $ne: null,
        $type: "object", // Ensure it's an object, not null
      },
      "deliveryReview.stars": { $exists: true }, // Ensure stars field exists
      "deliveryReview.reviewedAt": { $exists: true }, // Ensure reviewedAt exists
    })
      .populate("user.userId", "name")
      .select("deliveryReview createdAt user")
      .sort({ "deliveryReview.reviewedAt": -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalReviews = await Order.countDocuments({
      courier: courierId,
      deliveryReview: {
        $exists: true,
        $ne: null,
        $type: "object",
      },
      "deliveryReview.stars": { $exists: true },
    });

    // Get courier info with rating stats
    const courier = await User.findById(courierId).select(
      "name rating totalReviews"
    );
    // In your getCourierReviews function, add this:
    console.log("🔍 DEBUGGING: Let's see what's in the database...");

    // Check ALL orders for this courier (including those without reviews)
    const allOrdersForCourier = await Order.find({ courier: courierId })
      .select("_id deliveryReview")
      .sort({ createdAt: -1 });

    console.log(
      "📊 ALL orders for courier:",
      allOrdersForCourier.map((order) => ({
        orderId: order._id,
        hasReview: !!order.deliveryReview,
        reviewStars: order.deliveryReview?.stars || "N/A",
      }))
    );
    const ordersWithReviews = await Order.find({
      courier: courierId,
      "deliveryReview.stars": { $exists: true, $type: "number" },
    }).select("_id deliveryReview");

    console.log(
      "⭐ Orders WITH reviews:",
      ordersWithReviews.map((order) => ({
        orderId: order._id,
        stars: order.deliveryReview.stars,
      }))
    );

    console.log("🔍 END DEBUGGING");
    if (!courier) {
      return res.status(404).json({ message: "Courier not found" });
    }

    const reviews = orders
      .filter((order) => {
        // Additional safety check to filter out any orders that might have slipped through
        return (
          order.deliveryReview &&
          order.deliveryReview.stars !== undefined &&
          order.deliveryReview.reviewedAt
        );
      })
      .map((order) => {
        // Type assertions for populated fields
        const populatedUser = order.user.userId as any;

        return {
          id: order._id,
          stars: order.deliveryReview.stars,
          comment: order.deliveryReview.comment || "", // Provide default for optional comment
          reviewedAt: order.deliveryReview.reviewedAt,
          customerName: populatedUser?.name || "Anonymous", // Handle case where user might not be populated
          orderDate: order.createdAt,
        };
      });

    res.status(200).json({
      success: true,
      courier: {
        id: courier._id,
        name: courier.name,
        averageRating: courier.rating || 0,
        totalReviews: courier.totalReviews || 0,
      },
      reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalReviews / Number(limit)),
        totalReviews,
        hasNext: skip + orders.length < totalReviews,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("❌ Get courier reviews error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get user's review history
export const getUserReviewHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.log(`📋 Fetching review history for user: ${userId}`);

    // FIXED: More specific query to ensure deliveryReview has the required fields
    const orders = await Order.find({
      "user.userId": userId,
      deliveryReview: {
        $exists: true,
        $ne: null,
        $type: "object", // Ensure it's an object, not null
      },
      "deliveryReview.stars": { $exists: true }, // Ensure stars field exists
      "deliveryReview.reviewedAt": { $exists: true }, // Ensure reviewedAt exists
    })
      .populate("courier", "name")
      .select("deliveryReview createdAt courier items")
      .sort({ "deliveryReview.reviewedAt": -1 })
      .skip(skip)
      .limit(Number(limit));

    const totalReviews = await Order.countDocuments({
      "user.userId": userId,
      deliveryReview: {
        $exists: true,
        $ne: null,
        $type: "object",
      },
      "deliveryReview.stars": { $exists: true },
    });

    console.log(
      `📊 Found ${orders.length} orders with valid reviews out of ${totalReviews} total`
    );

    const reviews = orders
      .filter((order) => {
        // Additional safety check to filter out any orders that might have slipped through
        return (
          order.deliveryReview &&
          order.deliveryReview.stars !== undefined &&
          order.deliveryReview.reviewedAt
        );
      })
      .map((order) => {
        // Type assertions for populated fields
        const populatedCourier = order.courier as any;

        return {
          orderId: order._id,
          stars: order.deliveryReview.stars,
          comment: order.deliveryReview.comment || "", // Provide default for optional comment
          reviewedAt: order.deliveryReview.reviewedAt,
          courier: {
            id: populatedCourier?._id || null,
            name: populatedCourier?.name || "Unknown Courier", // Handle case where courier might not be populated
          },
          orderDate: order.createdAt,
          itemCount: order.items?.length || 0, // Handle potential undefined items
        };
      });

    console.log(`✅ Successfully processed ${reviews.length} valid reviews`);

    res.status(200).json({
      success: true,
      reviews,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalReviews / Number(limit)),
        totalReviews,
        hasNext: skip + orders.length < totalReviews,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    console.error("❌ Get user review history error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// Helper function to update courier rating
async function updateCourierRating(courierId: string, newStars: number) {
  try {
    const courier = await User.findById(courierId);
    if (!courier) return;

    const currentRating = courier.rating || 0;
    const currentTotal = courier.totalReviews || 0;

    // Calculate new average rating
    const newTotal = currentTotal + 1;
    const newRating = (currentRating * currentTotal + newStars) / newTotal;

    courier.rating = Math.round(newRating * 100) / 100; // Round to 2 decimal places
    courier.totalReviews = newTotal;

    await courier.save();

    console.log(
      `✅ Updated courier ${courierId} rating: ${courier.rating} (${courier.totalReviews} reviews)`
    );
  } catch (error) {
    console.error("❌ Error updating courier rating:", error);
  }
}

// Helper function to update courier rating when review is edited
async function updateCourierRatingOnEdit(
  courierId: string,
  oldStars: number,
  newStars: number
) {
  try {
    const courier = await User.findById(courierId);
    if (!courier) return;

    const currentRating = courier.rating || 0;
    const totalReviews = courier.totalReviews || 0;

    if (totalReviews === 0) return;

    // Remove old rating and add new rating
    const totalStars = currentRating * totalReviews - oldStars + newStars;
    const newRating = totalStars / totalReviews;

    courier.rating = Math.round(newRating * 100) / 100;

    await courier.save();

    console.log(
      `✅ Updated courier ${courierId} rating after edit: ${courier.rating}`
    );
  } catch (error) {
    console.error("❌ Error updating courier rating on edit:", error);
  }
}
// Add this function to your deliveryController.ts

// Get completed orders that can be reviewed (no existing review)
export const getReviewableOrders = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    console.log(`📋 Fetching reviewable orders for user: ${userId}`);

    // Get completed orders with courier assigned
    const completedOrders = await Order.find({
      "user.userId": userId,
      status: "completed",
      courier: { $exists: true, $ne: null },
    })
      .populate("courier", "name email")
      .select("_id createdAt courier items address deliveryReview")
      .sort({ createdAt: -1 });

    console.log(
      `📊 Found ${completedOrders.length} completed orders with couriers`
    );

    // Filter out orders that already have reviews
    const reviewableOrders = completedOrders.filter((order) => {
      // Check if order already has a valid review
      const hasValidReview =
        order.deliveryReview &&
        order.deliveryReview.stars &&
        order.deliveryReview.reviewedAt;

      return !hasValidReview; // Return orders without valid reviews
    });

    console.log(
      `✅ Found ${reviewableOrders.length} orders that can be reviewed`
    );

    // Format the response
    const formattedOrders = reviewableOrders.map((order) => {
      const populatedCourier = order.courier as any;

      return {
        _id: order._id.toString(),
        createdAt: order.createdAt,
        courier: {
          _id: populatedCourier?._id?.toString() || null,
          name: populatedCourier?.name || "Unknown Courier",
        },
        items: order.items || [],
        address: order.address,
        status: "completed",
      };
    });

    res.status(200).json({
      success: true,
      orders: formattedOrders,
      total: formattedOrders.length,
    });
  } catch (error) {
    console.error("❌ Get reviewable orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch reviewable orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
export const deleteDeliveryReview = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?.userId;

    console.log("🗑️ Deleting delivery review...");
    console.log("Order ID:", orderId);
    console.log("User ID:", userId);

    // Validation
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing order ID",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - user not found",
      });
    }

    // Find the order and populate courier data
    const order = await Order.findById(orderId)
      .populate("user.userId", "name email")
      .populate("courier", "name email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check authorization - user can only delete their own review
    if (order.user.userId._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this review",
      });
    }

    // Check if review exists
    if (!order.deliveryReview || !order.deliveryReview.stars) {
      return res.status(404).json({
        success: false,
        message: "No review found to delete",
      });
    }

    // Store the review data before deletion for courier rating update
    const deletedReviewStars = order.deliveryReview.stars;
    const populatedCourier = order.courier as any;

    console.log("📊 Review to be deleted:", {
      orderId: order._id,
      stars: deletedReviewStars,
      courierId: populatedCourier?._id,
      courierName: populatedCourier?.name,
    });

    // Remove the review from the order
    order.deliveryReview = undefined;
    await order.save();
    console.log("✅ Review removed from order");

    // THIS IS WHERE YOU USE removeCourierRating function
    let updatedCourier = null;
    if (populatedCourier && populatedCourier._id) {
      console.log("🔄 Updating courier rating...");
      updatedCourier = await removeCourierRating(
        populatedCourier._id.toString(),
        deletedReviewStars
      );

      if (updatedCourier) {
        console.log("✅ Courier rating updated successfully");
      } else {
        console.error("❌ Failed to update courier rating");
      }
    }

    console.log("✅ Delivery review deleted successfully");

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      deletedReview: {
        orderId: order._id,
        rating: deletedReviewStars,
        courier: {
          id: populatedCourier?._id,
          name: populatedCourier?.name,
          updatedRating: updatedCourier?.rating || 0,
          updatedTotalReviews: updatedCourier?.totalReviews || 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ Delete delivery review error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

async function removeCourierRating(courierId: string, removedStars: number) {
  try {
    console.log(
      `🔄 Starting removeCourierRating for courier ${courierId}, removing ${removedStars} stars`
    );

    // Instead of manual calculation, recalculate from actual database data
    // This ensures accuracy even if stats were previously wrong
    const updatedCourier = await recalculateCourierStats(courierId);

    if (!updatedCourier) {
      console.log(`❌ Failed to recalculate stats for courier ${courierId}`);
      return null;
    }

    console.log(`✅ AFTER deletion - Courier ${courierId}:`, {
      rating: updatedCourier.rating,
      totalReviews: updatedCourier.totalReviews,
    });

    return {
      id: updatedCourier._id,
      name: updatedCourier.name,
      rating: updatedCourier.rating,
      totalReviews: updatedCourier.totalReviews,
    };
  } catch (error) {
    console.error("❌ Error removing courier rating:", error);
    return null;
  }
}
async function recalculateCourierStats(courierId: string) {
  try {
    console.log(`🔄 Recalculating stats for courier ${courierId}`);

    // Get all orders with actual reviews for this courier
    const ordersWithReviews = await Order.find({
      courier: courierId,
      "deliveryReview.stars": { $exists: true, $type: "number" },
    }).select("deliveryReview.stars");

    console.log(`📊 Found ${ordersWithReviews.length} orders with reviews`);

    let totalReviews = ordersWithReviews.length;
    let averageRating = 0;

    if (totalReviews > 0) {
      const totalStars = ordersWithReviews.reduce((sum, order) => {
        return sum + order.deliveryReview.stars;
      }, 0);

      averageRating = totalStars / totalReviews;
      averageRating = Math.round(averageRating * 100) / 100; // Round to 2 decimal places
    }

    console.log(
      `🔢 Calculated stats: ${averageRating} average from ${totalReviews} reviews`
    );

    // Update the courier with correct stats
    const courier = await User.findByIdAndUpdate(
      courierId,
      {
        rating: averageRating,
        totalReviews: totalReviews,
      },
      { new: true }
    ).select("name rating totalReviews");

    console.log(`✅ Updated courier ${courierId}:`, {
      name: courier?.name,
      rating: courier?.rating,
      totalReviews: courier?.totalReviews,
    });

    return courier;
  } catch (error) {
    console.error("❌ Error recalculating courier stats:", error);
    return null;
  }
}

// Endpoint to manually fix courier stats (for testing)
export const fixCourierStats = async (req: Request, res: Response) => {
  try {
    const { courierId } = req.params;

    if (!courierId || !mongoose.Types.ObjectId.isValid(courierId)) {
      return res.status(400).json({ message: "Invalid courier ID" });
    }

    const updatedCourier = await recalculateCourierStats(courierId);

    if (!updatedCourier) {
      return res.status(404).json({ message: "Courier not found" });
    }

    res.status(200).json({
      success: true,
      message: "Courier stats recalculated successfully",
      courier: {
        id: updatedCourier._id,
        name: updatedCourier.name,
        rating: updatedCourier.rating,
        totalReviews: updatedCourier.totalReviews,
      },
    });
  } catch (error) {
    console.error("❌ Fix courier stats error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
