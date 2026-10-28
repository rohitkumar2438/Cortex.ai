/**
 * Shared DB connection helper for Cortex AI microservices.
 * @param {string} mongoUri - MongoDB connection URI. Defaults to process.env.MONGO_URI
 * @param {string} serviceName - Name of the calling service for logging
 * @param {object} [mongooseInstance] - Optional mongoose instance passed from caller
 */
export const connectDB = async (mongoUri = process.env.MONGO_URI, serviceName = 'Service', mongooseInstance = null) => {
    if (!mongoUri) {
        console.warn(`⚠️ [${serviceName}] MONGO_URI is not defined. Operating without active DB connection.`);
        return null;
    }

    try {
        let mg = mongooseInstance;
        if (!mg) {
            const imported = await import('mongoose');
            mg = imported.default || imported;
        }

        const conn = await mg.connect(mongoUri, {
            serverSelectionTimeoutMS: 5000,
            autoIndex: true
        });

        console.log(`✅ [${serviceName}] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
        return conn;
    } catch (error) {
        console.error(`❌ [${serviceName}] MongoDB Connection Error:`, error.message);
        return null;
    }
};

export default connectDB;
