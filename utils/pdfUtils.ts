import * as pdfjsLib from 'pdfjs-dist';
import { AppFile } from '../types';

// Handle potential ESM import structure differences (default vs named exports)
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Use a specific version or fallback. We point to the .mjs version for ESM compatibility.
const version = pdfjs.version || '5.4.449';
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.mjs`;

export const getPdfPageCount = async (file: File): Promise<number> => {
  const arrayBuffer = await file.arrayBuffer();
  // Using the resolved pdfjs instance
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const count = pdf.numPages;
  pdf.destroy(); 
  return count;
};

export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    // Limit to first 5 pages for AI analysis to save tokens/time
    const pagesToRead = Math.min(pdf.numPages, 5);
    
    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `Page ${i}: ${pageText}\n`;
      page.cleanup(); 
    }
    pdf.destroy(); 
    return fullText;
  } catch (error) {
    console.error("Error extracting text", error);
    return "";
  }
};

export const convertPdfToImages = async (
  pdfFile: AppFile,
  scale: number = 2,
  quality: number = 0.9,
  onProgress?: (progress: number) => void
): Promise<string[]> => {
  const arrayBuffer = await pdfFile.file.arrayBuffer();
  
  // Using the resolved pdfjs instance
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const images: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (!context) throw new Error('Canvas context not available');

        await page.render({
        canvasContext: context,
        viewport: viewport,
        }).promise;

        // Convert to JPEG
        const base64 = canvas.toDataURL('image/jpeg', quality);
        images.push(base64);

        // Free memory for this page
        page.cleanup();
    } catch (pageError) {
        console.error(`Error rendering page ${i}`, pageError);
    }

    if (onProgress) {
      onProgress(Math.round((i / totalPages) * 100));
    }
  }
  
  pdf.destroy();

  return images;
};