import { connectDB as sharedConnectDB } from '../../../shared/db.js';

const connectDB = async () => {
    return await sharedConnectDB(process.env.MONGO_URI, 'Auth Service');
};

export default connectDB;
