export type ToolId = 
  | 'pdf-to-jpg'
  | 'jpg-to-pdf'
  | 'png-to-jpg'
  | 'jpg-to-png'
  | 'webp-to-jpg'
  | 'compress-image'
  | 'zip-extractor'
  | 'ocr';

export interface AppFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  // Result properties
  outputFiles?: { name: string; blob: Blob }[]; // For converters
  textResult?: string; // For OCR
  preview?: string; // For images
}

export interface ToolConfig {
  id: ToolId;
  name: string;
  description: string;
  category: 'PDF' | 'Image' | 'Utility';
  accept: string;
  multiple: boolean;
}

export interface AiInsight {
  summary: string;
  keywords: string[];
}
