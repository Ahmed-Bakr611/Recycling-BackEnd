import User from "../models/users";
import Stripe from "stripe";
import { Request, Response } from "express";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-06-30.basil" });

export const createStripeCustomer = async (req:Request, res:Response) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        phone: user.phoneNumber,
        metadata: { userId: user.id },
      });
      user.stripeCustomerId = customer.id;
      await user.save();
    }

    res.json({ stripeCustomerId: user.stripeCustomerId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createPaymentIntent = async (req:Request, res:Response) => {
  try {
    const userId = req.params.id;
    const { amount } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.stripeCustomerId)
      return res.status(400).json({ error: "Stripe customer ID not found" });

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "egp",
      customer: user.stripeCustomerId,
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const getAllPaymentsForUser = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.stripeCustomerId)
      return res.status(400).json({ error: "Stripe customer ID not found" });

    // List all payment intents for this customer
    const paymentIntents = await stripe.charges.list({
      customer: user.stripeCustomerId,
      limit: 100, // max 100 per request, you can paginate if needed
    });

    res.json(paymentIntents.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};


interface PaymentsQueryParams {
  page?: string;
  limit?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  currency?: string;
  minAmount?: string;
  maxAmount?: string;
  country?: string;
  refunded?: string;
  disputed?: string;
}

export const getAllPayments = async (req: Request, res: Response) => {
  try {
    console.log('🔥 Request received:', req.method, req.originalUrl);
    console.log('Query params:', req.query);

    const {
      page = '1',
      limit = '25',
      status,
      startDate,
      endDate,
      search,
      currency,
      minAmount,
      maxAmount,
      country,
      refunded,
      disputed,
    } = req.query as PaymentsQueryParams;

    // Parse pagination parameters
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10))); // Cap at 100

    console.log('Parsed params:', { pageNum, limitNum, status, search });

    // Build Stripe query parameters
    const stripeParams: Stripe.ChargeListParams = {
      limit: Math.min(limitNum * 2, 100), // Fetch more to account for filtering
    };

    // Date filtering
    if (startDate || endDate) {
      stripeParams.created = {};
      
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          stripeParams.created.gte = Math.floor(start.getTime() / 1000);
          console.log('Start date filter:', new Date(stripeParams.created.gte * 1000));
        }
      }
      
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          // Add 23:59:59 to include the entire end date
          end.setHours(23, 59, 59, 999);
          stripeParams.created.lte = Math.floor(end.getTime() / 1000);
          console.log('End date filter:', new Date(stripeParams.created.lte * 1000));
        }
      }
    }

    // Customer filtering (if search includes email)
    if (search && search.includes('@')) {
      try {
        console.log('Searching for customer by email:', search);
        const customers = await stripe.customers.list({
          email: search,
          limit: 1,
        });
        
        if (customers.data.length > 0) {
          stripeParams.customer = customers.data[0].id;
          console.log('Found customer:', customers.data[0].id);
        } else {
          console.log('No customer found with email:', search);
        }
      } catch (error) {
        console.warn('Error searching customer by email:', error);
      }
    }

    console.log('Stripe params:', stripeParams);

    // Fetch charges from Stripe with pagination
    let allCharges: Stripe.Charge[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;
    let totalFetched = 0;
    const maxToFetch = Math.min(pageNum * limitNum * 3, 300); // Reasonable limit

    console.log('Starting to fetch charges...');

    while (hasMore && totalFetched < maxToFetch) {
      try {
        const charges = await stripe.charges.list({
          ...stripeParams,
          starting_after: startingAfter,
          limit: Math.min(100, maxToFetch - totalFetched),
        });

        console.log(`Fetched ${charges.data.length} charges, hasMore: ${charges.has_more}`);

        allCharges = allCharges.concat(charges.data);
        hasMore = charges.has_more;
        totalFetched += charges.data.length;
        
        if (charges.data.length > 0) {
          startingAfter = charges.data[charges.data.length - 1].id;
        } else {
          break;
        }

        // Safety break to avoid infinite loops
        if (totalFetched >= 500) {
          console.warn('Breaking fetch loop at 500 charges to avoid timeout');
          break;
        }
      } catch (stripeError) {
        console.error('Stripe API error:', stripeError);
        throw stripeError;
      }
    }

    console.log(`Total charges fetched: ${allCharges.length}`);

    // Apply client-side filtering for complex conditions
    let filteredCharges = allCharges.filter((charge) => {
      // Status filtering
      if (status) {
        const chargeStatus = getChargeStatus(charge);
        if (chargeStatus !== status) return false;
      }

      // Currency filtering
      if (currency && charge.currency !== currency.toLowerCase()) {
        return false;
      }

      // Amount filtering (amounts are in cents)
      if (minAmount) {
        const minAmountCents = parseFloat(minAmount) * 100;
        if (charge.amount < minAmountCents) return false;
      }

      if (maxAmount) {
        const maxAmountCents = parseFloat(maxAmount) * 100;
        if (charge.amount > maxAmountCents) return false;
      }

      // Country filtering
      if (country && charge.billing_details?.address?.country !== country.toUpperCase()) {
        return false;
      }

      // Refunded filtering
      if (refunded !== undefined) {
        const isRefunded = charge.refunded || charge.amount_refunded > 0;
        if (refunded === 'true' && !isRefunded) return false;
        if (refunded === 'false' && isRefunded) return false;
      }

      // Disputed filtering
      if (disputed !== undefined) {
        const isDisputed = charge.disputed;
        if (disputed === 'true' && !isDisputed) return false;
        if (disputed === 'false' && isDisputed) return false;
      }

      // Search filtering (search in various fields)
      if (search && !search.includes('@')) {
        const searchTerm = search.toLowerCase();
        const searchableFields = [
          charge.id,
          charge.billing_details?.email,
          charge.billing_details?.name,
          charge.description,
          charge.receipt_email,
          charge.billing_details?.phone,
        ].filter(Boolean);

        const matchesSearch = searchableFields.some(field => 
          field?.toString().toLowerCase().includes(searchTerm)
        );

        if (!matchesSearch) return false;
      }

      return true;
    });

    console.log(`Filtered charges: ${filteredCharges.length}`);

    // Calculate total count for pagination
    const totalCount = filteredCharges.length;
    const totalPages = Math.ceil(totalCount / limitNum);

    // Apply pagination
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedCharges = filteredCharges.slice(startIndex, startIndex + limitNum);

    console.log(`Paginated charges: ${paginatedCharges.length}`);

    // Calculate statistics
    const stats = calculatePaymentStats(filteredCharges);

    // Format response
    const response = {
      success: true,
      data: paginatedCharges,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
      stats,
      filters: {
        status,
        startDate,
        endDate,
        search,
        currency,
        minAmount,
        maxAmount,
        country,
        refunded,
        disputed,
      },
    };

    console.log('Response stats:', {
      totalCharges: response.data.length,
      totalCount: response.pagination.total,
      page: response.pagination.page,
      totalPages: response.pagination.totalPages,
    });

    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    
    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return res.status(400).json({ 
        success: false,
        error: "Stripe API error",
        message: error.message,
        type: error.type,
      });
    }

    res.status(500).json({ 
      success: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper function to determine charge status
function getChargeStatus(charge: Stripe.Charge): string {
  if (charge.refunded || charge.amount_refunded > 0) {
    return 'refunded';
  }
  
  if (charge.disputed) {
    return 'disputed';
  }
  
  if (charge.failure_code || charge.failure_message) {
    return 'failed';
  }
  
  if (charge.amount_captured === charge.amount) {
    return 'succeeded';
  }
  
  if (charge.amount_captured > 0 && charge.amount_captured < charge.amount) {
    return 'partially_captured';
  }
  
  return charge.status || 'pending';
}

// Helper function to calculate payment statistics
function calculatePaymentStats(charges: Stripe.Charge[]) {
  const totalAmount = charges.reduce((sum, charge) => sum + charge.amount, 0);
  
  const successfulCharges = charges.filter(charge => {
    const status = getChargeStatus(charge);
    return status === 'succeeded';
  });
  
  const totalRevenue = successfulCharges.reduce((sum, charge) => 
    sum + (charge.amount - charge.amount_refunded), 0
  );
  
  const successRate = charges.length > 0 
    ? Math.round((successfulCharges.length / charges.length) * 100) 
    : 0;

  const refundedAmount = charges.reduce((sum, charge) => sum + charge.amount_refunded, 0);

  const statusCounts = charges.reduce((counts, charge) => {
    const status = getChargeStatus(charge);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  return {
    totalCount: charges.length,
    totalAmount,
    totalRevenue,
    refundedAmount,
    successRate,
    statusCounts,
    averageAmount: charges.length > 0 ? Math.round(totalAmount / charges.length) : 0,
  };
}

// Additional endpoint for payment statistics only
export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const {
      startDate,
      endDate,
      status,
      currency,
    } = req.query as PaymentsQueryParams;

    const stripeParams: Stripe.ChargeListParams = {
      limit: 100,
    };

    // Apply date filtering
    if (startDate || endDate) {
      stripeParams.created = {};
      
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          stripeParams.created.gte = Math.floor(start.getTime() / 1000);
        }
      }
      
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          stripeParams.created.lte = Math.floor(end.getTime() / 1000);
        }
      }
    }

    // Fetch charges
    let allCharges: Stripe.Charge[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const charges = await stripe.charges.list({
        ...stripeParams,
        starting_after: startingAfter,
      });

      allCharges = allCharges.concat(charges.data);
      hasMore = charges.has_more;
      
      if (charges.data.length > 0) {
        startingAfter = charges.data[charges.data.length - 1].id;
      } else {
        break;
      }
    }

    // Apply filtering
    if (status || currency) {
      allCharges = allCharges.filter(charge => {
        if (status && getChargeStatus(charge) !== status) return false;
        if (currency && charge.currency !== currency.toLowerCase()) return false;
        return true;
      });
    }

    const stats = calculatePaymentStats(allCharges);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
};

// Endpoint to get a single payment by ID
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID is required',
      });
    }

    const charge = await stripe.charges.retrieve(id, {
      expand: ['payment_method', 'customer'],
    });

    res.json({
      success: true,
      data: charge,
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
        message: error.message,
      });
    }

    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
};
export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { userId, amount, successUrl, cancelUrl } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Optionally, create Stripe customer if not exists
    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        phone: user.phoneNumber,
        metadata: { userId: user.id },
      });
      user.stripeCustomerId = customer.id;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer: user.stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "egp",
            product_data: { name: "Your Product" }, // Change as needed
            unit_amount: amount, // in piasters (e.g., 1000 = 10 EGP)
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const refundPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    console.log('=== BACKEND REFUND DEBUG ===');
    console.log('Received ID:', id);
    console.log('ID type:', typeof id);
    console.log('ID length:', id.length);
    console.log('ID starts with:', id.substring(0, 3));
    console.log('Amount:', amount);
    console.log('Reason:', reason);
    console.log('============================');

    let refund;
    
    // Handle different ID types
    if (id.startsWith('pi_')) {
      // Payment Intent ID
      console.log('Attempting refund with Payment Intent ID...');
      
      // First verify the payment intent exists
      const paymentIntent = await stripe.paymentIntents.retrieve(id);
      console.log('Payment Intent status:', paymentIntent.status);
      console.log('Payment Intent amount:', paymentIntent.amount);
      
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: `Cannot refund payment with status: ${paymentIntent.status}`
        });
      }

      refund = await stripe.refunds.create({
        payment_intent: id,
        amount: amount || undefined,
        reason: reason || 'requested_by_customer'
      });
      
    } else if (id.startsWith('ch_')) {
      // Charge ID
      console.log('Attempting refund with Charge ID...');
      
      // First verify the charge exists
      const charge = await stripe.charges.retrieve(id);
      console.log('Charge status:', charge.status);
      console.log('Charge amount:', charge.amount);
      console.log('Charge paid:', charge.paid);
      
      if (!charge.paid) {
        return res.status(400).json({
          success: false,
          message: 'Cannot refund unpaid charge'
        });
      }

      refund = await stripe.refunds.create({
        charge: id,
        amount: amount || undefined,
        reason: reason || 'requested_by_customer'
      });
      
    } else {
      // Unknown format - try to determine what it is
      console.log('Unknown ID format, attempting to identify...');
      
      // Try to retrieve as different object types
      try {
        console.log('Trying as Payment Intent...');
        const paymentIntent = await stripe.paymentIntents.retrieve(id);
        console.log('Found as Payment Intent:', paymentIntent.id);
        
        refund = await stripe.refunds.create({
          payment_intent: id,
          amount: amount || undefined,
          reason: reason || 'requested_by_customer'
        });
        
      } catch (piError) {
        console.log('Not a Payment Intent, trying as Charge...');
        
        try {
          const charge = await stripe.charges.retrieve(id);
          console.log('Found as Charge:', charge.id);
          
          refund = await stripe.refunds.create({
            charge: id,
            amount: amount || undefined,
            reason: reason || 'requested_by_customer'
          });
          
        } catch (chargeError) {
          console.log('Not a Charge either. Errors:');
          console.log('PI Error:', piError.message);
          console.log('Charge Error:', chargeError.message);
          
          return res.status(404).json({
            success: false,
            message: `Invalid payment ID: ${id}. Not found as Payment Intent or Charge.`,
            debug: {
              id,
              piError: piError.message,
              chargeError: chargeError.message
            }
          });
        }
      }
    }

    console.log('Refund successful:', refund.id);

    res.status(200).json({
      success: true,
      message: "Payment refunded successfully",
      refund: {
        id: refund.id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        created: refund.created
      }
    });

  } catch (error: any) {
    console.error('=== REFUND ERROR ===');
    console.error('Error type:', error.type);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    console.error('====================');
    
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        message: `Stripe Error: ${error.message}`,
        debug: {
          type: error.type,
          code: error.code,
          param: error.param
        }
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to process refund",
      error: error.message
    });
  }
};
