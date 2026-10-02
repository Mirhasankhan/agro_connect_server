import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs-extra";

@Injectable()
export class FileService {
    constructor(private configService: ConfigService) {
        cloudinary.config({
            cloud_name:
                this.configService?.get("CLOUDINARY_CLOUD_NAME") ||
                process.env.CLOUDINARY_CLOUD_NAME,
            api_key:
                this.configService?.get("CLOUDINARY_API_KEY") ||
                process.env.CLOUDINARY_API_KEY,
            api_secret:
                this.configService?.get("CLOUDINARY_API_SECRET") ||
                process.env.CLOUDINARY_API_SECRET,
        });
    }

    async uploadToCloudinary(
        file: Express.Multer.File | string,
        folder: string = "projects",
    ): Promise<string> {
        const filePath = typeof file === "string" ? file : file.path;
        try {
            const result = await new Promise<{ secure_url: string }>(
                (resolve, reject) => {
                    cloudinary.uploader.upload(
                        filePath,
                        { folder },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result as { secure_url: string });
                        },
                    );
                },
            );
            if (typeof file !== "string" && file?.path) {
                await fs.unlink(file.path).catch(() => {});
            }
            return result.secure_url;
        } catch (error) {
            if (typeof file !== "string" && file?.path) {
                await fs.unlink(file.path).catch(() => {});
            }
            throw error;
        }
    }

    async uploadMultipleToCloudinary(
        files: Express.Multer.File[],
    ): Promise<string[]> {
        try {
            const uploadPromises = files.map((file) =>
                this.uploadToCloudinary(file),
            );
            return await Promise.all(uploadPromises);
        } catch (error) {
            throw error;
        }
    }

    async deleteFromCloudinary(url: string): Promise<void> {
        const publicId = decodeURIComponent(url).split("/").pop().split(".")[0];
        await new Promise((resolve, reject) => {
            cloudinary.uploader.destroy(publicId, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
    }

    // async deleteMultipleFromCloudinary(urls: string[]): Promise<void> {
    //     const results = await Promise.allSettled(
    //         urls.map((url) => this.deleteFromCloudinary(url)),
    //     );

    //     // Optional: log failed deletions
    //     results.forEach((result, index) => {
    //         if (result.status === "rejected") {
    //             console.error(
    //                 `Failed to delete Cloudinary file: ${urls[index]}`,
    //                 result.reason,
    //             );
    //         }
    //     });
    // }

    async deleteMultipleFromCloudinary(urls: string[]): Promise<void> {
        try {
            const deletePromises = urls.map((url) =>
                this.deleteFromCloudinary(url),
            );
            await Promise.all(deletePromises);
        } catch (error: unknown) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown error occurred";
            throw new Error(
                `Failed to delete files from Cloudinary: ${message}`,
            );
        }
    }
}
