import { Request, Response } from "express";
import Subscriber from "../models/subscribe";
import { sendSubscriptionEmail } from "../utils/helper";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const handleSubscription = async (req: Request, res: Response) => {
  const { email, name } = req.body;

  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  try {
    const existing = await Subscriber.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already subscribed" });
    }

    const subscriber = new Subscriber({ email, name });
    await subscriber.save();

    await sendSubscriptionEmail(email, name);

    return res.status(200).json({ message: "Subscription successful" });
  } catch (error) {
    console.error("Subscription error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
