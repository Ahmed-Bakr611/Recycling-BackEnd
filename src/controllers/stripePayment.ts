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
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const paymentIntents = await stripe.charges.list({
      limit: 100, // adjust or paginate as needed
    });
    res.json(paymentIntents.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
