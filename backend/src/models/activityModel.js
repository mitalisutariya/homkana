import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true, 
    enum: ['USER_REGISTER', 'ORDER_PLACED', 'CART_ADD', 'ORDER_STATUS_UPDATE', 'CATEGORY_MANAGEMENT', 'PRODUCT_MANAGEMENT'] 
  },
  description: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: { type: Object }
}, { timestamps: true });

const Activity = mongoose.model('Activity', activitySchema);
export default Activity;
