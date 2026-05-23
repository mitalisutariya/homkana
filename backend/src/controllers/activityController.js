import Activity from '../models/activityModel.js';

// @desc    Get recent activities
// @route   GET /api/activities
// @access  Private/Admin
export const getActivities = async (req, res) => {
  try {
    const activities = await Activity.find({}).sort('-createdAt').limit(50).populate('user', 'name email');
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
