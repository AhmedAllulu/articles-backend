// services/healthService.js
const db = require('../db/connections');
const logger = require('../config/logger');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class HealthService {
  /**
   * Get system health status
   * @returns {Promise<Object>} System health status
   */
  async getHealthStatus() {
    const startTime = Date.now();
    
    try {
      const [
        dbStatus,
        systemStatus,
        memoryStatus,
        diskStatus
      ] = await Promise.all([
        this.checkDatabaseConnection(),
        this.getSystemStatus(),
        this.getMemoryStatus(),
        this.getDiskStatus()
      ]);
      
      const responseTime = Date.now() - startTime;
      
      const status = 
        dbStatus.status === 'healthy' &&
        systemStatus.status === 'healthy' &&
        memoryStatus.status === 'healthy' &&
        diskStatus.status === 'healthy'
          ? 'healthy'
          : 'unhealthy';
      
      return {
        status,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        version: process.env.npm_package_version || '1.0.0',
        checks: {
          database: dbStatus,
          system: systemStatus,
          memory: memoryStatus,
          disk: diskStatus
        }
      };
    } catch (error) {
      logger.error(`Error getting health status: ${error.message}`);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
  
  /**
   * Check database connection
   * @returns {Promise<Object>} Database connection status
   */
  async checkDatabaseConnection() {
    try {
      // Check connection by querying system tables
      // Just check the first database for now
      const constants = require('../config/constants');
      const countries = require('../config/countries');
      
      const category = constants.CATEGORIES[0];
      const countryCode = countries[0].code;
      
      const result = await db.query(
        category,
        countryCode,
        'SELECT NOW() as time'
      );
      
      return {
        status: 'healthy',
        message: 'Database connection is working',
        dbTime: result.rows[0].time
      };
    } catch (error) {
      logger.error(`Database health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        message: `Database connection error: ${error.message}`
      };
    }
  }
  
  /**
   * Get system status
   * @returns {Promise<Object>} System status
   */
  async getSystemStatus() {
    try {
      const uptime = os.uptime();
      const loadAvg = os.loadavg();
      
      return {
        status: 'healthy',
        uptime: this.formatUptime(uptime),
        load: {
          '1m': loadAvg[0].toFixed(2),
          '5m': loadAvg[1].toFixed(2),
          '15m': loadAvg[2].toFixed(2)
        },
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length
      };
    } catch (error) {
      logger.error(`System health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        message: `System status error: ${error.message}`
      };
    }
  }
  
  /**
   * Get memory status
   * @returns {Promise<Object>} Memory status
   */
  async getMemoryStatus() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = (usedMem / totalMem * 100).toFixed(2);
      
      // Consider the system unhealthy if memory usage is over 90%
      const status = memoryUsagePercent < 90 ? 'healthy' : 'unhealthy';
      
      return {
        status,
        total: this.formatBytes(totalMem),
        free: this.formatBytes(freeMem),
        used: this.formatBytes(usedMem),
        usagePercent: `${memoryUsagePercent}%`
      };
    } catch (error) {
      logger.error(`Memory health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        message: `Memory status error: ${error.message}`
      };
    }
  }
  
  /**
   * Get disk status
   * @returns {Promise<Object>} Disk status
   */
  async getDiskStatus() {
    try {
      // Use df command to get disk usage
      const { stdout } = await execPromise('df -h | grep /$ || df -h | grep /dev/root');
      
      // Parse output
      const parts = stdout.trim().split(/\s+/);
      
      // Format: Filesystem, Size, Used, Avail, Use%, Mounted on
      const diskInfo = {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usagePercent: parts[4],
        mountPoint: parts[5]
      };
      
      // Extract usage percentage as number
      const usagePercent = parseInt(diskInfo.usagePercent.replace('%', ''), 10);
      
      // Consider the system unhealthy if disk usage is over 90%
      const status = usagePercent < 90 ? 'healthy' : 'unhealthy';
      
      return {
        status,
        ...diskInfo
      };
    } catch (error) {
      logger.error(`Disk health check failed: ${error.message}`);
      
      // Fallback method for Windows or if df command fails
      try {
        // Get disk usage from the logs directory (as a sample)
        const { stdout } = await execPromise('du -sh ./logs');
        
        return {
          status: 'unknown',
          message: 'Could not determine disk health, but logs directory is accessible',
          logsSize: stdout.split(/\s+/)[0]
        };
      } catch (fallbackError) {
        return {
          status: 'unhealthy',
          message: `Disk status error: ${error.message}`
        };
      }
    }
  }
  
  /**
   * Format bytes to human-readable format
   * @param {number} bytes - Bytes
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted bytes
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
  
  /**
   * Format uptime to human-readable format
   * @param {number} seconds - Uptime in seconds
   * @returns {string} Formatted uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    result += `${secs}s`;
    
    return result;
  }
}

module.exports = new HealthService();