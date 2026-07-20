/**
 * Image Compression Utility
 * Compresses images to WEBP or AVIF format with target size between 60KB-120KB
 */

const MIN_TARGET_SIZE = 60 * 1024; // 60KB
const MAX_TARGET_SIZE = 120 * 1024; // 120KB
const MAX_WIDTH = 1920; // Max width for product images
const MAX_HEIGHT = 1080; // Max height for product images
const PROFILE_MAX_SIZE = 100 * 1024; // 100KB for profile images
const PROFILE_MAX_DIMENSION = 500; // 500x500 for profile images

/**
 * Compress an image to WEBP format
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {number} options.maxWidth - Maximum width (default: 1920)
 * @param {number} options.maxHeight - Maximum height (default: 1080)
 * @param {number} options.targetSize - Target size in bytes (default: 90KB)
 * @param {number} options.minQuality - Minimum quality (default: 0.1)
 * @param {number} options.maxQuality - Maximum quality (default: 0.95)
 * @param {boolean} options.isProfile - Whether this is a profile image (default: false)
 * @returns {Promise<string>} - Base64 string of compressed image
 */
export const compressImage = async (file, options = {}) => {
  const {
    maxWidth = options.isProfile ? PROFILE_MAX_DIMENSION : MAX_WIDTH,
    maxHeight = options.isProfile ? PROFILE_MAX_DIMENSION : MAX_HEIGHT,
    targetSize = options.isProfile ? PROFILE_MAX_SIZE : (MIN_TARGET_SIZE + MAX_TARGET_SIZE) / 2,
    minQuality = 0.1,
    maxQuality = 0.95
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Binary search for optimal quality
        let low = minQuality;
        let high = maxQuality;
        let bestQuality = 0.8;
        let iterations = 0;
        const maxIterations = 10;

        const tryQuality = (quality) => {
          return new Promise((resolve) => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve({
                    dataUrl: URL.createObjectURL(blob),
                    size: blob.size,
                    quality
                  });
                } else {
                  resolve(null);
                }
              },
              'image/webp',
              quality
            );
          });
        };

        const binarySearch = async () => {
          while (iterations < maxIterations && high - low > 0.05) {
            iterations++;
            const mid = (low + high) / 2;
            const result = await tryQuality(mid);

            if (!result) {
              low = mid;
              continue;
            }

            if (result.size <= targetSize) {
              // Image is small enough, try higher quality
              bestQuality = mid;
              low = mid;
            } else {
              // Image is too large, try lower quality
              high = mid;
            }
          }

          // Get final result with best quality
          const finalResult = await tryQuality(bestQuality);
          if (finalResult) {
            // Convert blob URL to base64
            const xhr = new XMLHttpRequest();
            xhr.open('GET', finalResult.dataUrl, true);
            xhr.responseType = 'blob';
            xhr.onload = () => {
              const reader = new FileReader();
              reader.onloadend = () => {
                URL.revokeObjectURL(finalResult.dataUrl);
                resolve(reader.result);
              };
              reader.readAsDataURL(xhr.response);
            };
            xhr.onerror = () => reject(new Error('Failed to convert blob to base64'));
            xhr.send();
          } else {
            // Fallback: use canvas directly with default quality
            const dataUrl = canvas.toDataURL('image/webp', 0.8);
            resolve(dataUrl);
          }
        };

        binarySearch().catch(reject);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Compress image to AVIF format (fallback to WEBP if not supported)
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @returns {Promise<string>} - Base64 string of compressed image
 */
export const compressImageAVIF = async (file, options = {}) => {
  // Check if AVIF is supported
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const supportsAVIF = canvas.toDataURL('image/avif').startsWith('data:image/avif');

  if (supportsAVIF) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const {
            maxWidth = options.isProfile ? PROFILE_MAX_DIMENSION : MAX_WIDTH,
            maxHeight = options.isProfile ? PROFILE_MAX_DIMENSION : MAX_HEIGHT
          } = options;

          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Try AVIF with quality 0.8
          const dataUrl = canvas.toDataURL('image/avif', 0.8);
          
          // Check size and adjust if needed
          if (dataUrl.length > MAX_TARGET_SIZE) {
            // Fallback to WEBP if AVIF is too large
            compressImage(file, options).then(resolve).catch(reject);
          } else {
            resolve(dataUrl);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  } else {
    // Fallback to WEBP if AVIF not supported
    return compressImage(file, options);
  }
};

/**
 * Auto-detect best format and compress image
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @returns {Promise<string>} - Base64 string of compressed image
 */
export const compressImageAuto = async (file, options = {}) => {
  try {
    // Try AVIF first (better compression), fallback to WEBP
    return await compressImageAVIF(file, options);
  } catch (error) {
    console.warn('AVIF compression failed, falling back to WEBP:', error);
    return await compressImage(file, options);
  }
};

/**
 * Get compressed image info
 * @param {string} base64String - Base64 string of image
 * @returns {Object} - Image info { size, format, sizeInKB }
 */
export const getImageInfo = (base64String) => {
  const sizeInBytes = Math.round((base64String.length * 3) / 4);
  const sizeInKB = (sizeInBytes / 1024).toFixed(2);
  const format = base64String.match(/^data:image\/([a-zA-Z]+);/)?.[1] || 'unknown';
  
  return {
    size: sizeInBytes,
    sizeInKB,
    format
  };
};
