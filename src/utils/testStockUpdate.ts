import Category from '../models/category';
import { getSocketIO } from '../socket/socketServer';

// Test function to manually update a quantity and verify change stream
export const testStockUpdate = async (categoryId: string, itemId: string, newQuantity: number) => {
  try {
    console.log('🧪 Testing stock update...');
    console.log(`📋 Category ID: ${categoryId}`);
    console.log(`📋 Item ID: ${itemId}`);
    console.log(`📋 New Quantity: ${newQuantity}`);

    // Method 1: Direct quantity update (should trigger change stream)
    const result1 = await Category.updateOne(
      { _id: categoryId, "items._id": itemId },
      { $set: { "items.$.quantity": newQuantity } }
    );
    
    console.log('✅ Direct update result:', result1);

    // Also test with $inc method (like your stockHelper)
    setTimeout(async () => {
      const result2 = await Category.updateOne(
        { _id: categoryId, "items._id": itemId },
        { $inc: { "items.$.quantity": 1 } }
      );
      console.log('✅ Increment update result:', result2);
    }, 2000);

    // Method 3: Update by finding specific item index
    setTimeout(async () => {
      const category = await Category.findById(categoryId);
      if (category) {
        const itemIndex = category.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex !== -1) {
          const result3 = await Category.updateOne(
            { _id: categoryId },
            { $set: { [`items.${itemIndex}.quantity`]: newQuantity + 10 } }
          );
          console.log('✅ Index-based update result:', result3);
        }
      }
    }, 4000);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// API endpoint for testing (add this to a route)
export const createTestRoute = (router: any) => {
  router.post('/test-stock-update', async (req: any, res: any) => {
    try {
      const { categoryId, itemId, quantity } = req.body;
      
      if (!categoryId || !itemId || quantity === undefined) {
        return res.status(400).json({ 
          error: 'Missing required fields: categoryId, itemId, quantity' 
        });
      }

      await testStockUpdate(categoryId, itemId, quantity);
      
      res.json({ 
        success: true, 
        message: 'Test stock update initiated - check server logs',
        data: { categoryId, itemId, quantity }
      });
    } catch (error) {
      console.error('❌ Test route error:', error);
      res.status(500).json({ error: 'Test failed' });
    }
  });
};
