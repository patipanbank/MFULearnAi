import mongoose, { Model, Document } from 'mongoose';
import { Schema } from 'mongoose';

interface ISentimentRecord {
  userId: string;
  chatId: string;
  messageId: string;
  text: string;
  sentiment: string;
  confidence?: number;
  dateTime: Date;
}

// Define interface for static methods
interface ChatSentimentModel extends Model<ISentimentRecord & Document> {
  getSentimentDistribution(startDate?: Date, endDate?: Date): Promise<any[]>;
  getDailySentimentStats(startDate: Date, endDate: Date): Promise<any[]>;
}

const chatSentimentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  chatId: {
    type: String,
    required: true,
    index: true
  },
  messageId: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  sentiment: {
    type: String,
    required: true,
    enum: ['positive', 'negative', 'neutral', 'question', 'complaint', 'suggestion'],
    index: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  dateTime: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Add index for date range queries
chatSentimentSchema.index({ dateTime: 1 });

// Static methods for querying sentiment data
chatSentimentSchema.statics.getSentimentDistribution = async function(startDate?: Date, endDate?: Date) {
  const query: any = {};
  
  if (startDate || endDate) {
    query.dateTime = {};
    if (startDate) query.dateTime.$gte = startDate;
    if (endDate) query.dateTime.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: query },
    { 
      $group: { 
        _id: '$sentiment',
        count: { $sum: 1 }
      } 
    },
    { $sort: { count: -1 } }
  ]);
};

// Add method to retrieve daily sentiment stats
chatSentimentSchema.statics.getDailySentimentStats = async function(startDate: Date, endDate: Date) {
  return this.aggregate([
    { 
      $match: { 
        dateTime: { 
          $gte: startDate, 
          $lte: endDate 
        } 
      } 
    },
    {
      $group: {
        _id: {
          date: { 
            $dateToString: { 
              format: '%Y-%m-%d', 
              date: '$dateTime',
              timezone: '+07:00' 
            } 
          },
          sentiment: '$sentiment'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1, count: -1 } }
  ]);
};

export const ChatSentiment = mongoose.model<ISentimentRecord & mongoose.Document, ChatSentimentModel>(
  'ChatSentiment', 
  chatSentimentSchema
); 