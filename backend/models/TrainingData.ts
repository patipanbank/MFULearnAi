import mongoose from 'mongoose';

interface ITrainingData extends mongoose.Document {
  name: string;
  content: string;
  embedding: number[];
  metadata?: Map<string, any>;
  createdBy?: {
    nameID: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  isActive: boolean;
  fileType?: string;
  createdAt: Date;
  score?: number;
}

interface TrainingDataModel extends mongoose.Model<ITrainingData> {
  findSimilar(embedding: number[], limit?: number): Promise<ITrainingData[]>;
}

const trainingDataSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    sparse: true,
    index: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  createdBy: {
    nameID: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    firstName: {
      type: String
    },
    lastName: {
      type: String
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  fileType: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true, index: { embedding: '2dsphere' } });

trainingDataSchema.statics.findSimilar = async function(embedding: number[], limit = 5) {
  return this.aggregate([
    {
      $search: {
        knnBeta: {
          vector: embedding,
          path: "embedding",
          k: limit
        }
      }
    }
  ]);
};

export default mongoose.model<ITrainingData, TrainingDataModel>('TrainingData', trainingDataSchema); 