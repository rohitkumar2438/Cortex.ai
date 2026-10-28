import mongoose from 'mongoose';
import { connectDB as sharedConnectDB } from '../../../shared/db.js';

const connectDB = async () => {
    return await sharedConnectDB(process.env.MONGO_URI, 'Billing Service', mongoose);
};

export default connectDB;
