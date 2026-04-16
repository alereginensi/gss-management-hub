import { v2 as cloudinary } from 'cloudinary';

// Solo pisamos la config explícita si las 3 variables separadas están
// presentes. Si la cuenta usa CLOUDINARY_URL (formato `cloudinary://key:secret@cloud`),
// el SDK auto-detecta y configurar con undefines la anularía.
if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
}

export async function uploadToCloudinary(buffer: Buffer, folder: string, filename: string, resourceType: 'auto' | 'image' | 'raw' = 'auto'): Promise<string> {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: filename,
                resource_type: resourceType,
            },
            (error, result) => {
                if (error || !result) return reject(error ?? new Error('Upload failed'));
                let url = result.secure_url;
                // With resource_type:'auto', Cloudinary stores raw files (docx, xlsx, etc.)
                // with the format separate from the public_id, so secure_url may lack the
                // extension. Append it from result.format so the stored URL is downloadable
                // with the correct filename.
                if (result.format && result.resource_type === 'raw') {
                    const ext = `.${result.format.toLowerCase()}`;
                    if (!url.toLowerCase().endsWith(ext)) {
                        url = `${url}.${result.format}`;
                    }
                }
                resolve(url);
            }
        );
        uploadStream.end(buffer);
    });
}

export async function deleteFromCloudinary(url: string): Promise<void> {
    try {
        // Extract public_id from Cloudinary URL
        // e.g. https://res.cloudinary.com/duk6nukpt/image/upload/v123/logbook/filename
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
        if (!match) return;
        await cloudinary.uploader.destroy(match[1]);
    } catch {
        // Non-critical — just log
        console.error('Cloudinary delete failed for:', url);
    }
}
