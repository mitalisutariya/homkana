import Category from '../models/categoryModel.js';
import Activity from '../models/activityModel.js';

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort('name');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a category
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;
    const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    
    const category = new Category({ name, slug, icon });
    const createdCategory = await category.save();

    // Log activity
    const activity = await Activity.create({
      type: 'CATEGORY_MANAGEMENT', 
      description: `New category added: ${name} ${icon}`,
      metadata: { categoryId: createdCategory._id }
    });
    
    const io = req.app.get('io');
    if (io) io.emit('admin_activity', activity);

    res.status(201).json(createdCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (category) {
      const name = category.name;
      await category.deleteOne();

      const io = req.app.get('io');
      if (io) io.emit('admin_activity', { type: 'CATEGORY_MANAGEMENT', description: `Category deleted: ${name}` });

      res.json({ message: 'Category removed' });
    } else {
      res.status(404);
      throw new Error('Category not found');
    }
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};
