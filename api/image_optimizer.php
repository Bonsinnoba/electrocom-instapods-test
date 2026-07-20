<?php
/**
 * Image Optimizer
 * Compresses images and converts to WebP format for better performance
 */

class ImageOptimizer {
    private $maxWidth = 1920;
    private $maxHeight = 1080;
    private $quality = 85;
    private $webpQuality = 80;

    /**
     * Optimize an image file
     * @param string $sourcePath Path to source image
     * @param string $destinationPath Path to save optimized image
     * @param bool $convertToWebP Whether to convert to WebP format
     * @return bool Success status
     */
    public function optimize(string $sourcePath, string $destinationPath, bool $convertToWebP = true): bool
    {
        if (!file_exists($sourcePath)) {
            return false;
        }

        $imageInfo = getimagesize($sourcePath);
        if (!$imageInfo) {
            return false;
        }

        $mime = $imageInfo['mime'];
        $image = $this->loadImage($sourcePath, $mime);
        
        if (!$image) {
            return false;
        }

        // Resize if too large
        $image = $this->resizeIfNeeded($image, $imageInfo[0], $imageInfo[1]);

        // Save optimized image
        if ($convertToWebP && function_exists('imagewebp')) {
            $destinationPath = preg_replace('/\.(jpg|jpeg|png)$/i', '.webp', $destinationPath);
            imagewebp($image, $destinationPath, $this->webpQuality);
        } else {
            $this->saveImage($image, $destinationPath, $mime);
        }

        imagedestroy($image);
        
        return file_exists($destinationPath);
    }

    /**
     * Load image based on MIME type
     */
    private function loadImage(string $path, string $mime)
    {
        switch ($mime) {
            case 'image/jpeg':
                return imagecreatefromjpeg($path);
            case 'image/png':
                return imagecreatefrompng($path);
            case 'image/gif':
                return imagecreatefromgif($path);
            case 'image/webp':
                return imagecreatefromwebp($path);
            default:
                return null;
        }
    }

    /**
     * Save image based on MIME type
     */
    private function saveImage($image, string $path, string $mime)
    {
        switch ($mime) {
            case 'image/jpeg':
                imagejpeg($image, $path, $this->quality);
                break;
            case 'image/png':
                imagepng($image, $path, round(9 * ($this->quality / 100)));
                break;
            case 'image/gif':
                imagegif($image, $path);
                break;
            case 'image/webp':
                imagewebp($image, $path, $this->webpQuality);
                break;
        }
    }

    /**
     * Resize image if it exceeds max dimensions
     */
    private function resizeIfNeeded($image, int $width, int $height)
    {
        if ($width <= $this->maxWidth && $height <= $this->maxHeight) {
            return $image;
        }

        $ratio = min($this->maxWidth / $width, $this->maxHeight / $height);
        $newWidth = round($width * $ratio);
        $newHeight = round($height * $ratio);

        $newImage = imagecreatetruecolor($newWidth, $newHeight);
        
        // Preserve transparency for PNG
        if (imagesx($image) > 0 && imagesy($image) > 0) {
            imagealphablending($newImage, false);
            imagesavealpha($newImage, true);
            $transparent = imagecolorallocatealpha($newImage, 255, 255, 255, 127);
            imagefilledrectangle($newImage, 0, 0, $newWidth, $newHeight, $transparent);
        }

        imagecopyresampled($newImage, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagedestroy($image);

        return $newImage;
    }

    /**
     * Get optimized image URL
     * @param string $originalPath Original image path
     * @return string Optimized image path
     */
    public static function getOptimizedPath(string $originalPath): string
    {
        $webpPath = preg_replace('/\.(jpg|jpeg|png)$/i', '.webp', $originalPath);
        
        // Return WebP if it exists and is newer
        if (file_exists($webpPath) && filemtime($webpPath) >= filemtime($originalPath)) {
            return $webpPath;
        }
        
        return $originalPath;
    }

    /**
     * Batch optimize images in a directory
     * @param string $directory Directory path
     * @param bool $recursive Whether to process subdirectories
     * @return array Results with success/failure counts
     */
    public function batchOptimizeDirectory(string $directory, bool $recursive = false): array
    {
        $results = [
            'success' => 0,
            'failed' => 0,
            'skipped' => 0
        ];

        $iterator = $recursive 
            ? new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory))
            : new DirectoryIterator($directory);

        foreach ($iterator as $file) {
            if ($file->isFile() && $this->isImageFile($file->getPathname())) {
                $destination = $file->getPathname();
                if ($this->optimize($file->getPathname(), $destination)) {
                    $results['success']++;
                } else {
                    $results['failed']++;
                }
            }
        }

        return $results;
    }

    /**
     * Check if file is an image
     */
    private function isImageFile(string $path): bool
    {
        $imageInfo = getimagesize($path);
        return $imageInfo !== false;
    }
}

// Export function for use in other files
if (!function_exists('optimizeImage')) {
    function optimizeImage(string $sourcePath, string $destinationPath, bool $convertToWebP = true): bool
    {
        static $optimizer = null;
        if ($optimizer === null) {
            $optimizer = new ImageOptimizer();
        }
        return $optimizer->optimize($sourcePath, $destinationPath, $convertToWebP);
    }
}

if (!function_exists('getOptimizedImagePath')) {
    function getOptimizedImagePath(string $originalPath): string
    {
        return ImageOptimizer::getOptimizedPath($originalPath);
    }
}
