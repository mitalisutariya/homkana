import mongoose from 'mongoose';
import Product from '../models/productModel.js';
import { getAvailableStock, getSellPrice } from '../utils/inventory.js';

// @desc    Fetch all products with filters, search, and sorting
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
  try {
    const { 
      keyword, 
      category, 
      brand, 
      minPrice, 
      maxPrice, 
      rating, 
      sort,
      page = 1,
      limit = 12
    } = req.query;

    const query = {};

    // 1. Smart Search (Name, Brand, Category, Description)
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { brand: { $regex: keyword, $options: 'i' } },
        { category: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } }
      ];
    }

    // 2. Filters
    if (category) query.category = category.toLowerCase();
    if (brand) query.brand = brand;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (rating) query.rating = { $gte: Number(rating) };

    // 3. Sorting
    let sortOptions = {};
    if (sort === 'priceLow') sortOptions = { price: 1 };
    else if (sort === 'priceHigh') sortOptions = { price: -1 };
    else if (sort === 'newest') sortOptions = { createdAt: -1 };
    else if (sort === 'rating') sortOptions = { rating: -1 };
    else if (sort === 'popular') sortOptions = { reviewCount: -1 };
    else sortOptions = { createdAt: -1 }; // Default

    // 4. Pagination
    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip(skip);

    const total = await Product.countDocuments(query);

    res.json({
      products,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('relatedProducts');
    if (product) {
      let related = product.relatedProducts || [];
      // If no explicit related products, find products in the same category
      if (related.length === 0) {
        related = await Product.find({ 
          _id: { $ne: product._id }, 
          category: product.category 
        }).limit(4);
      }
      
      // We can return related in a wrapper or add to the product object.
      // Usually better to return them alongside to not mess up schema typing unnecessarily,
      // but let's just append it to a lean object
      const productObj = product.toObject();
      productObj.relatedProducts = related;

      res.json(productObj);
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    res.status(404).json({ message: 'Product not found' });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  try {
    const {
      name, price, mrp, description, images, brand, category,
      stockCount, discount, flashSale, variants, deliveryDays,
    } = req.body;

    const productExists = await Product.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (productExists) {
      return res.status(400).json({ message: 'Product with this name already exists' });
    }

    const product = new Product({
      name: name || 'New Product',
      price: Number(price) || 0,
      mrp: Number(mrp) || Number(price) || 0,
      description: description || 'No description',
      images: images || ['https://via.placeholder.com/300'],
      brand: brand || 'Generic',
      category: (category || 'general').toLowerCase(),
      stockCount: Number(stockCount) || 0,
      discount: Number(discount) || 0,
      flashSale: !!flashSale,
      deliveryDays: Number(deliveryDays) || 3,
      variants: Array.isArray(variants) ? variants : [],
    });

    const createdProduct = await product.save();
    const io = req.app.get('io');
    if (io) io.emit('stock_update', { productId: createdProduct._id, stockCount: createdProduct.stockCount, inStock: createdProduct.inStock });

    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
  try {
    const {
      name, price, mrp, description, images, brand, category,
      stockCount, discount, flashSale, variants, deliveryDays,
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (product) {
      if (name !== undefined) product.name = name;
      if (price !== undefined) product.price = Number(price);
      if (mrp !== undefined) product.mrp = Number(mrp);
      if (description !== undefined) product.description = description;
      if (images !== undefined) product.images = images;
      if (brand !== undefined) product.brand = brand;
      if (category !== undefined) product.category = category;
      if (stockCount !== undefined) product.stockCount = Number(stockCount);
      if (discount !== undefined) product.discount = Number(discount);
      if (flashSale !== undefined) product.flashSale = flashSale;
      if (deliveryDays !== undefined) product.deliveryDays = Number(deliveryDays);
      if (variants !== undefined) product.variants = variants;

      const updatedProduct = await product.save();
      const io = req.app.get('io');
      if (io) {
        io.emit('stock_update', {
          productId: updatedProduct._id,
          stockCount: updatedProduct.stockCount,
          inStock: updatedProduct.inStock,
          variants: updatedProduct.variants,
        });
      }
      res.json(updatedProduct);
    } else {
      res.status(404);
      throw new Error('Product not found');
    }
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
// @desc    Validate cart lines against live inventory
// @route   POST /api/products/validate-cart
// @access  Public
export const validateCartStock = async (req, res) => {
  try {
    const lines = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!lines.length) {
      return res.json({ valid: true, items: [] });
    }

    const results = [];
    const removed = [];
    let allValid = true;

    for (const line of lines) {
      const productId = line.product || line.productId || line._id || line.id;
      const qty = Math.max(1, Number(line.qty) || 1);
      const variantKey = line.variantKey || null;

      if (!productId || !mongoose.Types.ObjectId.isValid(String(productId))) {
        removed.push({ name: line.name || 'Unknown item', reason: 'Invalid product' });
        allValid = false;
        results.push({
          product: null,
          variantKey,
          qty,
          availableStock: 0,
          isValid: false,
          inStock: false,
          message: 'Product not found',
          name: line.name,
        });
        continue;
      }

      const product = await Product.findById(productId);
      if (!product) {
        removed.push({ name: line.name || 'Unknown item', reason: 'Product not found' });
        allValid = false;
        results.push({
          product: null,
          variantKey,
          qty,
          availableStock: 0,
          isValid: false,
          inStock: false,
          message: 'Product not found',
          name: line.name,
        });
        continue;
      }

      const availableStock = getAvailableStock(product, variantKey);
      const isValid = availableStock >= qty;
      if (!isValid) allValid = false;

      results.push({
        product: product._id,
        variantKey,
        qty,
        availableStock,
        isValid,
        inStock: availableStock > 0,
        message: isValid
          ? 'OK'
          : availableStock === 0
            ? 'Out of stock'
            : `Only ${availableStock} available`,
        name: product.name,
        price: getSellPrice(product, variantKey),
        mrp: product.mrp,
        discount: product.discount,
        stockCount: availableStock,
        variants: product.variants || [],
        images: product.images,
        brand: product.brand,
        category: product.category,
        inStockProduct: product.inStock,
      });
    }

    res.json({ valid: allValid, items: results, removed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    console.log(`Attempting to delete product with ID: ${req.params.id}`);
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (deletedProduct) {
      console.log(`Product ${req.params.id} deleted successfully`);
      res.json({ message: 'Product removed' });
    } else {
      console.log(`Product ${req.params.id} not found in DB`);
      res.status(404).json({ message: 'Product not found' });
    }
  } catch (error) {
    console.error(`Error deleting product ${req.params.id}:`, error.message);
    res.status(500).json({ message: error.message });
  }
};
