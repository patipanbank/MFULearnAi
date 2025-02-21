import express from 'express';
import modelRoutes from './routes/model';
// ... other imports

const app = express();

// ... your middleware setups

// Mount the model routes on /api/model
app.use('/api/model', modelRoutes);

// ... other routes and server start logic 