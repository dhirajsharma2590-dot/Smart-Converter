import Tesseract from 'tesseract.js';

export const performOcr = async (file: File): Promise<string> => {
    try {
        // Resolve Tesseract instance safely
        const tesseractInstance = (Tesseract as any).default || Tesseract;

        const result = await tesseractInstance.recognize(
            file,
            'eng', // Default to English
            { 
                logger: (m: any) => console.log(m) 
            }
        );
        return result.data.text;
    } catch (error) {
        console.error("OCR Failed", error);
        throw new Error("Text recognition failed. Please try again.");
    }
};