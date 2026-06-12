import mongoose from 'mongoose';
import 'dotenv/config';

export default async function main() {
    await mongoose.connect(process.env.MONGOOSE_KEY)
        .then(() => {
            console.log("Database Connected Successfully!");
        })
        .catch((err) => {
            console.log("Database Connection Failed!", err);
        });
}

