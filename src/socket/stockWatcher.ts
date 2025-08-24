import { ChangeStream } from 'mongodb';
import { getSocketIO } from './socketServer';
import Category, { ICategory } from '../models/category';
import { IItem } from '../models/item';

// Define proper types for MongoDB change stream events
interface ChangeStreamEvent {
  operationType: 'insert' | 'update' | 'delete' | 'replace' | 'invalidate';
  documentKey?: { _id: any };
  fullDocument?: any;
  fullDocumentBeforeChange?: any;
  updateDescription?: {
    updatedFields: Record<string, any>;
    removedFields?: string[];
  };
  ns?: {
    db: string;
    coll: string;
  };
}

// Global tracking for emission rate limiting
const emissionTracker = {
  lastEmissions: new Map<string, number>()
};

interface StockUpdateData {
  itemId: string;
  categoryId: string;
  quantity: number;
  name: any; // Could be string or IBilingualText
  categoryName: any; // Could be string or IBilingualText
  previousQuantity?: number;
  changeAmount?: number;
}

interface StockEmitData {
  type: 'update' | 'insert' | 'delete';
  categoryId: string;
  categoryName: any;
  items: StockUpdateData[];
  timestamp: Date;
  totalItems: number;
}

let stockChangeStream: ChangeStream | null = null;
let lastEmissionTime = 0;
const EMISSION_THROTTLE_MS = 500; // Minimum time between emissions

// Throttle function to prevent excessive emissions
const throttleEmission = (fn: () => void) => {
  const now = Date.now();
  if (now - lastEmissionTime >= EMISSION_THROTTLE_MS) {
    lastEmissionTime = now;
    fn();
  } else {
    // Debounce if called too frequently
    setTimeout(() => {
      const laterNow = Date.now();
      if (laterNow - lastEmissionTime >= EMISSION_THROTTLE_MS) {
        lastEmissionTime = laterNow;
        fn();
      }
    }, EMISSION_THROTTLE_MS - (now - lastEmissionTime));
  }
};

export const initializeStockWatcher = async (): Promise<void> => {
  try {
    const io = getSocketIO();
    if (!io) {
      console.error('❌ Socket.IO not initialized - cannot start stock watcher');
      return;
    }

    // Close existing stream if any
    if (stockChangeStream) {
      await stockChangeStream.close();
    }

    console.log('🔄 Initializing stock watcher...');

    // Create change stream to watch Category collection
    stockChangeStream = Category.watch([
      {
        $match: {
          $or: [
            // Watch for ANY updates (we'll filter in code)
            { 'operationType': 'update' },
            // Watch for new categories
            { 'operationType': 'insert' },
            // Watch for category deletions
            { 'operationType': 'delete' }
          ]
        }
      }
    ], {
      fullDocument: 'updateLookup', // Get the full document after update
      fullDocumentBeforeChange: 'whenAvailable' // Get document before change (MongoDB 6.0+)
    });

    stockChangeStream.on('change', async (change: any) => {
      try {
        // Add detailed logging for all changes
        console.log('🔍 Change detected:', {
          operationType: change.operationType,
          documentKey: change.documentKey,
          hasFullDocument: !!change.fullDocument,
          hasUpdateDescription: !!change.updateDescription,
          updatedFields: change.updateDescription?.updatedFields ? Object.keys(change.updateDescription.updatedFields) : 'none'
        });
        
        await handleStockChange(change, io);
      } catch (error) {
        console.error('❌ Error handling stock change:', error);
      }
    });

    stockChangeStream.on('error', (error) => {
      console.error('❌ Stock watcher error:', error);
      // Attempt to restart the watcher after a delay
      setTimeout(() => {
        console.log('🔄 Attempting to restart stock watcher...');
        initializeStockWatcher();
      }, 5000);
    });

    stockChangeStream.on('close', () => {
      console.log('📡 Stock watcher closed');
    });

    console.log('✅ Stock watcher initialized successfully');

  } catch (error) {
    console.error('❌ Failed to initialize stock watcher:', error);
  }
};

const handleStockChange = async (change: any, io: any): Promise<void> => {
  const { operationType, documentKey, fullDocument, fullDocumentBeforeChange, updateDescription } = change;

  try {
    switch (operationType) {
      case 'update':
        await handleUpdateOperation(change, io);
        break;
      
      case 'insert':
        await handleInsertOperation(change, io);
        break;
      
      case 'delete':
        await handleDeleteOperation(change, io);
        break;
      
      default:
        console.log(`🔄 Unhandled operation type: ${operationType}`);
    }
  } catch (error) {
    console.error(`❌ Error handling ${operationType} operation:`, error);
  }
};

const handleUpdateOperation = async (change: any, io: any): Promise<void> => {
  const { fullDocument, fullDocumentBeforeChange, updateDescription } = change;
  
  console.log('🔧 Handling update operation:', {
    hasFullDocument: !!fullDocument,
    hasUpdateDescription: !!updateDescription,
    updatedFields: updateDescription?.updatedFields ? Object.keys(updateDescription.updatedFields) : 'none'
  });
  
  if (!fullDocument || !updateDescription?.updatedFields) {
    console.log('⚠️ Missing required data for update operation');
    return;
  }

  const category = fullDocument as ICategory;
  const updatedFields = updateDescription.updatedFields;
  const stockUpdates: StockUpdateData[] = [];

  console.log('🔍 Checking updated fields:', Object.keys(updatedFields));

  // Check for quantity updates
  for (const fieldPath in updatedFields) {
    console.log(`🔍 Examining field: ${fieldPath} = ${updatedFields[fieldPath]}`);
    
    const quantityMatch = fieldPath.match(/^items\.(\d+)\.quantity$/);
    
    if (quantityMatch) {
      console.log('✅ Found quantity update match!', quantityMatch);
      const itemIndex = parseInt(quantityMatch[1]);
      const item = category.items[itemIndex];
      
      if (item) {
        const newQuantity = updatedFields[fieldPath];
        let previousQuantity = newQuantity; // Default fallback
        
        // Try to get previous quantity from fullDocumentBeforeChange
        if (fullDocumentBeforeChange && fullDocumentBeforeChange.items && fullDocumentBeforeChange.items[itemIndex]) {
          previousQuantity = fullDocumentBeforeChange.items[itemIndex].quantity;
        }

        stockUpdates.push({
          itemId: item._id.toString(),
          categoryId: category._id.toString(),
          quantity: newQuantity,
          name: item.name,
          categoryName: category.name,
          previousQuantity,
          changeAmount: newQuantity - previousQuantity
        });

        console.log(`📦 Stock change detected: ${item.name?.en || item.name} - ${previousQuantity} → ${newQuantity} (${newQuantity - previousQuantity > 0 ? '+' : ''}${newQuantity - previousQuantity})`);
      } else {
        console.log(`❌ Item at index ${itemIndex} not found in category`);
      }
    } else {
      console.log(`⏭️ Field ${fieldPath} doesn't match quantity pattern`);
    }
  }

  // Check for items array updates (new items added/removed)
  if (updatedFields.items) {
    // Get all current items for full update
    const allItems: StockUpdateData[] = category.items.map((item: IItem) => ({
      itemId: item._id.toString(),
      categoryId: category._id.toString(),
      quantity: item.quantity,
      name: item.name,
      categoryName: category.name
    }));

    if (allItems.length > 0) {
      const emitData: StockEmitData = {
        type: 'update',
        categoryId: category._id.toString(),
        categoryName: category.name,
        items: allItems,
        timestamp: new Date(),
        totalItems: allItems.length
      };

      io.emit('stock:category-updated', emitData);
      // Also emit to specific stock-updates room
      io.to('stock-updates').emit('stock:category-updated', emitData);
      console.log(`📦 Category items updated: ${category.name?.en || category.name} (${allItems.length} items)`);
    }
  }

  // Emit individual stock updates with throttling
  if (stockUpdates.length > 0) {
    const emitData: StockEmitData = {
      type: 'update',
      categoryId: category._id.toString(),
      categoryName: category.name,
      items: stockUpdates,
      timestamp: new Date(),
      totalItems: stockUpdates.length
    };

    console.log('🚀 About to emit stock updates:', {
      itemCount: stockUpdates.length,
      categoryId: category._id.toString(),
      categoryName: category.name?.en || category.name
    });

    throttleEmission(() => {
      io.emit('stock:updated', emitData);
      // Also emit to specific stock-updates room
      io.to('stock-updates').emit('stock:updated', emitData);
      console.log(`📡 Stock update emitted for ${stockUpdates.length} items in category: ${category.name?.en || category.name}`);
    });
  } else {
    console.log('⚠️ No stock updates to emit');
  }
};

const handleInsertOperation = async (change: any, io: any): Promise<void> => {
  const { fullDocument } = change;
  
  if (!fullDocument) return;

  const category = fullDocument as ICategory;
  
  const allItems: StockUpdateData[] = category.items.map((item: IItem) => ({
    itemId: item._id.toString(),
    categoryId: category._id.toString(),
    quantity: item.quantity,
    name: item.name,
    categoryName: category.name
  }));

  const emitData: StockEmitData = {
    type: 'insert',
    categoryId: category._id.toString(),
    categoryName: category.name,
    items: allItems,
    timestamp: new Date(),
    totalItems: allItems.length
  };

  io.emit('stock:category-added', emitData);
  // Also emit to specific stock-updates room
  io.to('stock-updates').emit('stock:category-added', emitData);
  console.log(`✨ New category added: ${category.name?.en || category.name} with ${allItems.length} items`);
};

const handleDeleteOperation = async (change: any, io: any): Promise<void> => {
  const { documentKey } = change;
  
  if (!documentKey?._id) return;

  const emitData = {
    type: 'delete',
    categoryId: documentKey._id.toString(),
    timestamp: new Date()
  };

  io.emit('stock:category-deleted', emitData);
  // Also emit to specific stock-updates room
  io.to('stock-updates').emit('stock:category-deleted', emitData);
  console.log(`🗑️ Category deleted: ${documentKey._id}`);
};

export const closeStockWatcher = async (): Promise<void> => {
  if (stockChangeStream) {
    await stockChangeStream.close();
    stockChangeStream = null;
    console.log('📡 Stock watcher closed');
  }
};

// Function to manually emit current stock state (useful for new connections)
export const emitCurrentStockState = async (socketId?: string): Promise<void> => {
  try {
    const io = getSocketIO();
    if (!io) return;

    // Add rate limiting for full state emissions per socket
    const now = Date.now();
    const socketKey = socketId || 'global';
    
    const lastEmission = emissionTracker.lastEmissions.get(socketKey) || 0;
    if (now - lastEmission < 1000) { // Minimum 1 second between full state emissions per socket
      console.log(`⏳ Rate limiting stock state emission for ${socketId ? `socket ${socketId}` : 'global'}`);
      return;
    }
    
    emissionTracker.lastEmissions.set(socketKey, now);

    const categories = await Category.find({}).lean();
    
    const stockData = categories.map(category => {
      const items: StockUpdateData[] = category.items.map((item: any) => ({
        itemId: item._id.toString(),
        categoryId: category._id.toString(),
        quantity: item.quantity,
        name: item.name,
        categoryName: category.name
      }));

      return {
        type: 'full-state' as const,
        categoryId: category._id.toString(),
        categoryName: category.name,
        items,
        timestamp: new Date(),
        totalItems: items.length
      };
    });

    const emitTarget = socketId ? io.to(socketId) : io;
    emitTarget.emit('stock:full-state', {
      categories: stockData,
      timestamp: new Date(),
      totalCategories: stockData.length,
      totalItems: stockData.reduce((sum, cat) => sum + cat.totalItems, 0)
    });

    console.log(`📊 Stock full state emitted${socketId ? ` to socket ${socketId}` : ' to all clients'} - ${stockData.length} categories, ${stockData.reduce((sum, cat) => sum + cat.totalItems, 0)} items`);
  } catch (error) {
    console.error('❌ Error emitting current stock state:', error);
  }
};
