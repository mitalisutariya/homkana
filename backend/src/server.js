import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.set('io', io);

// Handle socket connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Listen for cart additions from frontend
  socket.on('cart_addition', (data) => {
    // Broadcast to admin
    io.emit('admin_activity', {
      type: 'CART_ADD',
      description: `${data.user || 'A user'} added ${data.productName} to cart`,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middlewares
app.use(cors());
app.use(express.json());

// Import Routes
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import configRoutes from './routes/configRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import couponRoutes from './routes/couponRoutes.js';

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/config', configRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupons', couponRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('HomeKana API is running...');
});

// Seed Admin User (Temporary function for initialization)
import User from './models/userModel.js';
import Product from './models/productModel.js';
import Coupon from './models/couponModel.js';
const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ email: 'admin@gmail.com' });
    if (!adminExists) {
      await User.create({
        name: 'Admin User',
        email: 'admin@gmail.com',
        password: 'admin123',
        role: 'admin'
      });
      console.log('Admin user seeded successfully!');
    }
  } catch (error) {
    console.error(`Error seeding admin: ${error.message}`);
  }
};
seedAdmin();

// Seed Categories
import Category from './models/categoryModel.js';
const seedCategories = async () => {
  try {
    const count = await Category.countDocuments();
    if (count === 0) {
      const initialCats = [
        { name: 'Electronics', slug: 'electronics', icon: '📱' },
        { name: 'Fashion', slug: 'fashion', icon: '👗' },
        { name: 'Home Decor', slug: 'home-decor', icon: '🏠' },
        { name: 'Kitchen', slug: 'kitchen', icon: '🍳' },
        { name: 'Sports', slug: 'sports', icon: '⚽' },
        { name: 'Books', slug: 'books', icon: '📚' },
        { name: 'Beauty', slug: 'beauty', icon: '💄' },
        { name: 'Toys', slug: 'toys', icon: '🧸' },
        { name: 'Furniture', slug: 'furniture', icon: '🛋️' }
      ];
      await Category.insertMany(initialCats);
      console.log('Categories seeded successfully!');
    }
  } catch (error) {
    console.error(`Error seeding categories: ${error.message}`);
  }
};
seedCategories();

// Seed Sample Products
const seedProducts = async () => {
  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      const sampleProducts = [
        {
          name: 'Samsung Galaxy S23 Ultra',
          brand: 'Samsung',
          category: 'electronics',
          price: 89999,
          mrp: 124999,
          discount: 28,
          rating: 4.6,
          reviewCount: 3842,
          images: ['https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600&q=80'],
          description: 'Experience the next level of mobile photography with 200MP camera, S Pen, and Snapdragon 8 Gen 2.',
          specs: { Display: '6.8" Dynamic AMOLED 2X', Processor: 'Snapdragon 8 Gen 2', RAM: '12GB', Storage: '256GB', Battery: '5000mAh' },
          tags: ['bestseller'],
          inStock: true,
          stockCount: 50,
          deliveryDays: 2,
          flashSale: true
        },
        {
          name: 'Apple iPhone 15 Pro',
          brand: 'Apple',
          category: 'electronics',
          price: 119999,
          mrp: 134900,
          discount: 11,
          rating: 4.8,
          reviewCount: 5120,
          images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80'],
          description: 'Titanium design, A17 Pro chip, and a 48MP main camera with 4K 60fps video.',
          specs: { Display: '6.1" Super Retina XDR', Processor: 'A17 Pro', RAM: '8GB', Storage: '128GB', Battery: '3274mAh' },
          tags: ['new'],
          inStock: true,
          stockCount: 30,
          deliveryDays: 1,
          flashSale: false
        },
        {
          name: 'Sony WH-1000XM5 Headphones',
          brand: 'Sony',
          category: 'electronics',
          price: 24990,
          mrp: 34990,
          discount: 29,
          rating: 4.7,
          reviewCount: 2210,
          images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80'],
          description: 'Industry-leading noise cancellation with 30-hour battery life and premium sound.',
          specs: { Type: 'Over-ear', 'Noise Cancellation': 'Yes', Battery: '30 Hours', Connectivity: 'Bluetooth 5.2', Weight: '250g' },
          tags: ['bestseller'],
          inStock: true,
          stockCount: 25,
          deliveryDays: 2,
          flashSale: true
        },
        {
          name: 'Organic Beauty Skincare Set',
          brand: 'NaturalGlow',
          category: 'beauty',
          price: 1499,
          mrp: 2499,
          discount: 40,
          rating: 4.5,
          reviewCount: 876,
          images: ['https://images.unsplash.com/photo-1556228720-1929251d76e0?w=600&q=80'],
          description: 'Complete organic skincare set with cleanser, toner, serum, and moisturizer for all skin types.',
          specs: { SkinType: 'All', Ingredients: 'Organic', Contains: '4 items', Size: '100ml each' },
          tags: ['new'],
          inStock: true,
          stockCount: 100,
          deliveryDays: 3,
          flashSale: false
        },
        {
          name: 'Premium Fiction Collection',
          brand: 'BookHaven',
          category: 'books',
          price: 899,
          mrp: 1299,
          discount: 31,
          rating: 4.3,
          reviewCount: 456,
          images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&q=80'],
          description: 'A curated collection of 5 bestselling fiction novels from renowned authors.',
          specs: { Format: 'Hardcover', Pages: '1500 total', Language: 'English' },
          tags: [],
          inStock: true,
          stockCount: 75,
          deliveryDays: 4,
          flashSale: false
        },
        {
          name: 'Modern Velvet Sofa',
          brand: 'HomeComfort',
          category: 'furniture',
          price: 34999,
          mrp: 49999,
          discount: 30,
          rating: 4.4,
          reviewCount: 230,
          images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80'],
          description: 'Elegant 3-seater velvet sofa with solid wood frame and premium cushioning.',
          specs: { Seating: '3-seater', Material: 'Velvet', Frame: 'Solid Wood', Color: 'Royal Blue' },
          tags: ['bestseller'],
          inStock: true,
          stockCount: 10,
          deliveryDays: 7,
          flashSale: false
        },
        {
          name: 'Stainless Steel Cookware Set',
          brand: 'ChefPro',
          category: 'kitchen',
          price: 3999,
          mrp: 6999,
          discount: 43,
          rating: 4.6,
          reviewCount: 1120,
          images: ['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&q=80'],
          description: 'Complete 10-piece stainless steel cookware set with induction-ready bases.',
          specs: { Pieces: '10', Material: 'Stainless Steel', Compatible: 'Induction, Gas, Electric', Warranty: '5 Years' },
          tags: ['new'],
          inStock: true,
          stockCount: 45,
          deliveryDays: 3,
          flashSale: true
        },
        {
          name: 'Yoga Mat Premium',
          brand: 'FitLife',
          category: 'sports',
          price: 1299,
          mrp: 1999,
          discount: 35,
          rating: 4.2,
          reviewCount: 678,
          images: ['https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=600&q=80'],
          description: 'Extra thick eco-friendly yoga mat with non-slip surface and carrying strap.',
          specs: { Thickness: '6mm', Material: 'Eco-friendly TPE', Size: '183x61cm', Includes: 'Carrying strap' },
          tags: [],
          inStock: true,
          stockCount: 80,
          deliveryDays: 2,
          flashSale: false
        },
        {
          name: 'Decorative Wall Clock',
          brand: 'Timeless',
          category: 'home-decor',
          price: 2499,
          mrp: 3999,
          discount: 38,
          rating: 4.1,
          reviewCount: 345,
          images: ['https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=600&q=80'],
          description: 'Modern minimalist wall clock with silent movement and wooden frame.',
          specs: { Diameter: '12 inches', Material: 'Wood, Glass', Movement: 'Quartz Silent', Battery: '1 AA' },
          tags: [],
          inStock: true,
          stockCount: 40,
          deliveryDays: 4,
          flashSale: false
        },
        {
          name: 'Wireless Earbuds Pro',
          brand: 'SoundMax',
          category: 'electronics',
          price: 3499,
          mrp: 5999,
          discount: 42,
          rating: 4.4,
          reviewCount: 1567,
          images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80'],
          description: 'True wireless earbuds with active noise cancellation and 30-hour total battery life.',
          specs: { Battery: '30 hours', ANC: 'Yes', WaterResistance: 'IPX5', Bluetooth: '5.3' },
          tags: ['bestseller'],
          inStock: true,
          stockCount: 60,
          deliveryDays: 2,
          flashSale: true
        },
        {
          name: 'Casual Cotton T-Shirt',
          brand: 'UrbanWear',
          category: 'fashion',
          price: 599,
          mrp: 999,
          discount: 40,
          rating: 4.0,
          reviewCount: 2341,
          images: ['https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80'],
          description: 'Comfortable 100% cotton t-shirt with a modern fit. Available in multiple colors.',
          specs: { Material: '100% Cotton', Fit: 'Regular', Care: 'Machine washable', Availability: 'Multiple colors' },
          tags: [],
          inStock: true,
          stockCount: 200,
          deliveryDays: 3,
          flashSale: false
        },
        {
          name: 'Smart Fitness Watch',
          brand: 'FitTech',
          category: 'sports',
          price: 7999,
          mrp: 11999,
          discount: 33,
          rating: 4.5,
          reviewCount: 890,
          images: ['https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&q=80'],
          description: 'Advanced smartwatch with heart rate monitor, GPS, and 50+ workout modes.',
          specs: { Display: '1.4" AMOLED', Sensors: 'HR, SpO2, GPS', Battery: '7 days', WaterResistance: '50m' },
          tags: ['new'],
          inStock: true,
          stockCount: 35,
          deliveryDays: 2,
          flashSale: false
        }
      ];
      await Product.insertMany(sampleProducts);
      console.log('Sample products seeded successfully!');
    }
  } catch (error) {
    console.error(`Error seeding products: ${error.message}`);
  }
};
seedProducts();

const seedCoupons = async () => {
  try {
    const count = await Coupon.countDocuments();
    if (count === 0) {
      await Coupon.insertMany([
        { code: 'HOME10', description: '10% off on orders above ₹999', type: 'percentage', value: 10, minOrderAmount: 999, maxDiscount: 500, isActive: true },
        { code: 'FLAT100', description: '₹100 off on orders above ₹1499', type: 'fixed', value: 100, minOrderAmount: 1499, isActive: true },
      ]);
      console.log('Sample coupons seeded successfully!');
    }
  } catch (error) {
    console.error(`Error seeding coupons: ${error.message}`);
  }
};
seedCoupons();

// Normalize existing product categories to lowercase
const normalizeProductCategories = async () => {
  try {
    const products = await Product.find({ category: { $exists: true } });
    for (const product of products) {
      if (product.category !== product.category.toLowerCase()) {
        product.category = product.category.toLowerCase();
        await product.save();
      }
    }
    console.log('Product categories normalized to lowercase.');
  } catch (err) {
    console.error('Category normalization failed:', err);
  }
};
normalizeProductCategories();

// Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
