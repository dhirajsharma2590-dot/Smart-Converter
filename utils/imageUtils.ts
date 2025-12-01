import { jsPDF } from 'jspdf';

export const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Generic converter for images
export const convertImage = async (
  file: File, 
  targetFormat: 'image/jpeg' | 'image/png',
  quality: number = 0.92
): Promise<Blob> => {
  const base64 = await readFileAsBase64(file);
  const img = await loadImage(base64);
  
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');
  
  // Fill white background for JPEGs (transparency fix)
  if (targetFormat === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  
  ctx.drawImage(img, 0, 0);
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Conversion failed'));
    }, targetFormat, quality);
  });
};

// Compress image
export const compressImage = async (file: File, quality: number = 0.6): Promise<Blob> => {
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return convertImage(file, type as any, quality);
};

// Convert multiple images to a single PDF
export const imagesToPdf = async (files: File[]): Promise<Blob> => {
  // Safely resolve jsPDF constructor
  // Some CDN builds export it as default, others as named.
  const JsPDFConstructor = (jsPDF as any).default || jsPDF || (window as any).jspdf?.jsPDF;

  if (!JsPDFConstructor) {
    throw new Error("PDF Library failed to load. Please refresh.");
  }

  const doc = new JsPDFConstructor({
    orientation: 'p',
    unit: 'mm',
    format: 'a4'
  });

  const PageWidth = 210;
  const PageHeight = 297;
  const Margin = 10;

  for (let i = 0; i < files.length; i++) {
    if (i > 0) doc.addPage();
    
    const base64 = await readFileAsBase64(files[i]);
    const img = await loadImage(base64);
    
    // Calculate aspect ratio to fit page
    const imgRatio = img.width / img.height;
    const pageRatio = (PageWidth - Margin * 2) / (PageHeight - Margin * 2);
    
    let w, h;
    if (imgRatio > pageRatio) {
      w = PageWidth - Margin * 2;
      h = w / imgRatio;
    } else {
      h = PageHeight - Margin * 2;
      w = h * imgRatio;
    }
    
    const x = (PageWidth - w) / 2;
    const y = (PageHeight - h) / 2;
    
    const format = files[i].type === 'image/png' ? 'PNG' : 'JPEG';
    doc.addImage(base64, format, x, y, w, h);
  }

  return doc.output('blob');
};