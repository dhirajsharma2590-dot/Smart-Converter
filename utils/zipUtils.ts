import JSZip from 'jszip';

export const extractZip = async (file: File): Promise<{name: string, blob: Blob}[]> => {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);
    const extractedFiles: {name: string, blob: Blob}[] = [];

    // Iterate through all files in the zip
    const promises: Promise<void>[] = [];
    
    loadedZip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
            const promise = zipEntry.async('blob').then(blob => {
                // simple cleanup of path to just get filename if nested
                const name = relativePath.split('/').pop() || relativePath; 
                extractedFiles.push({ name, blob });
            });
            promises.push(promise);
        }
    });

    await Promise.all(promises);
    return extractedFiles;
};
