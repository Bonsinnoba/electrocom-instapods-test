<?php

/**
 * Object Cache - WordPress-style caching API
 * Provides a simple interface for caching data with multiple backend support
 */

if (!defined('CACHE_DIR')) {
    define('CACHE_DIR', __DIR__ . '/cache');
}

// Ensure cache directory exists
if (!is_dir(CACHE_DIR)) {
    mkdir(CACHE_DIR, 0755, true);
}

/**
 * Cache backend interface
 */
interface CacheBackend {
    public function get(string $key, string $group = 'default');
    public function set(string $key, $data, string $group = 'default', int $expire = 0): bool;
    public function delete(string $key, string $group = 'default'): bool;
    public function flush(): bool;
    public function exists(string $key, string $group = 'default'): bool;
}

/**
 * File-based cache backend
 */
class FileCacheBackend implements CacheBackend {
    private $cacheDir;
    
    public function __construct(string $cacheDir = null) {
        $this->cacheDir = $cacheDir ?: CACHE_DIR;
    }
    
    private function getFilePath(string $key, string $group): string {
        $group = preg_replace('/[^a-zA-Z0-9_-]/', '_', $group);
        $key = preg_replace('/[^a-zA-Z0-9_-]/', '_', $key);
        $groupDir = $this->cacheDir . '/' . $group;
        if (!is_dir($groupDir)) {
            mkdir($groupDir, 0755, true);
        }
        return $groupDir . '/' . $key . '.cache';
    }
    
    public function get(string $key, string $group = 'default') {
        $filePath = $this->getFilePath($key, $group);
        
        if (!file_exists($filePath)) {
            return false;
        }
        
        $content = file_get_contents($filePath);
        if ($content === false) {
            return false;
        }
        
        $data = unserialize($content);
        
        // Check expiration
        if ($data['expire'] > 0 && $data['expire'] < time()) {
            $this->delete($key, $group);
            return false;
        }
        
        return $data['value'];
    }
    
    public function set(string $key, $data, string $group = 'default', int $expire = 0): bool {
        $filePath = $this->getFilePath($key, $group);
        
        $cacheData = [
            'value' => $data,
            'expire' => $expire > 0 ? time() + $expire : 0,
            'created' => time()
        ];
        
        $result = file_put_contents($filePath, serialize($cacheData), LOCK_EX);
        return $result !== false;
    }
    
    public function delete(string $key, string $group = 'default'): bool {
        $filePath = $this->getFilePath($key, $group);
        if (file_exists($filePath)) {
            return unlink($filePath);
        }
        return true;
    }
    
    public function flush(): bool {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($this->cacheDir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                unlink($file->getPathname());
            } elseif ($file->isDir()) {
                rmdir($file->getPathname());
            }
        }
        
        return true;
    }
    
    public function exists(string $key, string $group = 'default'): bool {
        $filePath = $this->getFilePath($key, $group);
        if (!file_exists($filePath)) {
            return false;
        }
        
        // Check expiration
        $content = file_get_contents($filePath);
        if ($content === false) {
            return false;
        }
        
        $data = unserialize($content);
        if ($data['expire'] > 0 && $data['expire'] < time()) {
            $this->delete($key, $group);
            return false;
        }
        
        return true;
    }
}

/**
 * Redis cache backend (optional)
 */
class RedisCacheBackend implements CacheBackend {
    private $redis;
    private $prefix;
    
    public function __construct(string $host = '127.0.0.1', int $port = 6379, string $prefix = 'eh_') {
        if (!class_exists('Redis')) {
            throw new Exception('Redis extension not installed');
        }
        
        $this->redis = new Redis();
        $this->redis->connect($host, $port);
        $this->prefix = $prefix;
    }
    
    private function getKey(string $key, string $group): string {
        return $this->prefix . $group . ':' . $key;
    }
    
    public function get(string $key, string $group = 'default') {
        $redisKey = $this->getKey($key, $group);
        $data = $this->redis->get($redisKey);
        
        if ($data === false) {
            return false;
        }
        
        return unserialize($data);
    }
    
    public function set(string $key, $data, string $group = 'default', int $expire = 0): bool {
        $redisKey = $this->getKey($key, $group);
        $serialized = serialize($data);
        
        if ($expire > 0) {
            return $this->redis->setex($redisKey, $expire, $serialized);
        }
        
        return $this->redis->set($redisKey, $serialized);
    }
    
    public function delete(string $key, string $group = 'default'): bool {
        $redisKey = $this->getKey($key, $group);
        return $this->redis->del($redisKey) > 0;
    }
    
    public function flush(): bool {
        $pattern = $this->prefix . '*';
        $keys = $this->redis->keys($pattern);
        
        if (empty($keys)) {
            return true;
        }
        
        return $this->redis->del($keys) > 0;
    }
    
    public function exists(string $key, string $group = 'default'): bool {
        $redisKey = $this->getKey($key, $group);
        return $this->redis->exists($redisKey) > 0;
    }
}

/**
 * Global cache instance
 */
$cacheBackend = null;

/**
 * Initialize cache backend
 */
function eh_cache_init(): CacheBackend {
    global $cacheBackend;
    
    if ($cacheBackend !== null) {
        return $cacheBackend;
    }
    
    // Check if Redis is configured
    $redisHost = getenv('REDIS_HOST') ?: '127.0.0.1';
    $redisPort = getenv('REDIS_PORT') ?: 6379;
    $useRedis = getenv('USE_REDIS') === 'true';
    
    if ($useRedis && class_exists('Redis')) {
        try {
            $cacheBackend = new RedisCacheBackend($redisHost, $redisPort);
            return $cacheBackend;
        } catch (Exception $e) {
            // Fall back to file cache if Redis fails
            error_log('Redis cache failed, falling back to file cache: ' . $e->getMessage());
        }
    }
    
    // Default to file-based cache
    $cacheBackend = new FileCacheBackend();
    return $cacheBackend;
}

/**
 * WordPress-style cache API
 */

/**
 * Retrieve data from cache
 * 
 * @param string $key The cache key
 * @param string $group The cache group
 * @return mixed|false The cached data or false if not found
 */
function eh_cache_get(string $key, string $group = 'default') {
    $backend = eh_cache_init();
    return $backend->get($key, $group);
}

/**
 * Save data to cache
 * 
 * @param string $key The cache key
 * @param mixed $data The data to cache
 * @param string $group The cache group
 * @param int $expire Expiration time in seconds (0 for no expiration)
 * @return bool True on success, false on failure
 */
function eh_cache_set(string $key, $data, string $group = 'default', int $expire = 0): bool {
    $backend = eh_cache_init();
    return $backend->set($key, $data, $group, $expire);
}

/**
 * Delete data from cache
 * 
 * @param string $key The cache key
 * @param string $group The cache group
 * @return bool True on success, false on failure
 */
function eh_cache_delete(string $key, string $group = 'default'): bool {
    $backend = eh_cache_init();
    return $backend->delete($key, $group);
}

/**
 * Check if data exists in cache
 * 
 * @param string $key The cache key
 * @param string $group The cache group
 * @return bool True if exists, false otherwise
 */
function eh_cache_exists(string $key, string $group = 'default'): bool {
    $backend = eh_cache_init();
    return $backend->exists($key, $group);
}

/**
 * Clear all cache
 * 
 * @return bool True on success, false on failure
 */
function eh_cache_flush(): bool {
    $backend = eh_cache_init();
    return $backend->flush();
}

/**
 * Retrieve data from cache, or compute if not found
 * 
 * @param string $key The cache key
 * @param callable $callback The function to compute the data if not cached
 * @param string $group The cache group
 * @param int $expire Expiration time in seconds
 * @return mixed The cached or computed data
 */
function eh_cache_remember(string $key, callable $callback, string $group = 'default', int $expire = 0) {
    $data = eh_cache_get($key, $group);
    
    if ($data !== false) {
        return $data;
    }
    
    $data = $callback();
    eh_cache_set($key, $data, $group, $expire);
    
    return $data;
}
