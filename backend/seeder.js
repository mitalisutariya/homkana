import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import Product from './src/models/productModel.js';
import { products as mockProducts } from '../src/data/products.js';

dotenv.config();

connectDB();

const importData = async () => {
  try {
    await Product.deleteMany(); // Clear existing products

    // Transform mock products to match our MongoDB schema 
    // (mockProducts might have IDs as integers, Mongoose handles _id separately)
    const formattedProducts = mockProducts.map(p => ({
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      mrp: p.mrp,
      discount: p.discount,
      rating: p.rating,
      reviewCount: p.reviewCount,
      images: p.images,
      description: p.description,
      specs: p.specs || {},
      tags: p.tags || [],
      inStock: p.inStock !== false,
      stockCount: 100, // default stock
      flashSale: p.tags?.includes('flashsale') || false
    }));

    await Product.insertMany(formattedProducts);
    console.log('Mock Data Imported to MongoDB Successfully!');
    process.exit();
  } catch (error) {
    console.error(`Error importing data: ${error.message}`);
    process.exit(1);
  }
};

importData();
