const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');

const execAsync = promisify(exec);

class DependencyManager {
  constructor() {
    this.progressCallback = null;
  }

  async checkDependencies() {
    const status = {
      ngrok: await this.checkCommand('ngrok', '--version'),
      supergateway: await this.checkNpmPackage('supergateway'),
      brew: await this.checkCommand('brew', '--version')
    };
    
    return status;
  }

  async checkCommand(command, args) {
    try {
      await execAsync(`${command} ${args}`);
      return true;
    } catch {
      return false;
    }
  }

  async checkNpmPackage(packageName) {
    try {
      await execAsync(`npm list -g ${packageName}`);
      return true;
    } catch {
      return false;
    }
  }

  async installDependencies(onProgress) {
    this.progressCallback = onProgress;
    
    const status = await this.checkDependencies();
    const toInstall = [];

    if (!status.brew) {
      throw new Error('Homebrew is not installed. Please install Homebrew first: https://brew.sh');
    }

    if (!status.ngrok) {
      toInstall.push({ name: 'ngrok', type: 'brew' });
    }

    if (!status.supergateway) {
      toInstall.push({ name: 'supergateway', type: 'npm' });
    }

    const total = toInstall.length;
    let current = 0;

    for (const pkg of toInstall) {
      current++;
      this.reportProgress({
        total,
        current,
        currentPackage: pkg.name,
        message: `Installing ${pkg.name}...`
      });

      if (pkg.type === 'brew') {
        await this.installWithBrew(pkg.name);
      } else if (pkg.type === 'npm') {
        await this.installWithNpm(pkg.name);
      }
    }

    if (total > 0) {
      this.reportProgress({
        total,
        current: total,
        currentPackage: '',
        message: 'All dependencies installed successfully!'
      });
    }
  }

  async installWithBrew(packageName) {
    return new Promise((resolve, reject) => {
      const process = spawn('brew', ['install', packageName], {
        stdio: 'pipe'
      });

      process.stdout.on('data', (data) => {
        console.log(`brew install ${packageName}: ${data}`);
      });

      process.stderr.on('data', (data) => {
        console.error(`brew install ${packageName} error: ${data}`);
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to install ${packageName} with brew`));
        }
      });
    });
  }

  async installWithNpm(packageName) {
    return new Promise((resolve, reject) => {
      const process = spawn('npm', ['install', '-g', packageName], {
        stdio: 'pipe'
      });

      process.stdout.on('data', (data) => {
        console.log(`npm install ${packageName}: ${data}`);
      });

      process.stderr.on('data', (data) => {
        console.error(`npm install ${packageName} error: ${data}`);
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to install ${packageName} with npm`));
        }
      });
    });
  }

  async configureNgrok(authtoken) {
    if (!authtoken || authtoken.trim().length === 0) {
      throw new Error('Auth token is required');
    }

    // Check if ngrok is installed
    const hasNgrok = await this.checkCommand('ngrok', '--version');
    if (!hasNgrok) {
      throw new Error('ngrok is not installed. Please install dependencies first.');
    }

    // Configure ngrok with the auth token
    return new Promise((resolve, reject) => {
      const process = spawn('ngrok', ['config', 'add-authtoken', authtoken.trim()], {
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('ngrok configured successfully:', output);
          resolve();
        } else {
          reject(new Error(`Failed to configure ngrok: ${errorOutput || output}`));
        }
      });
    });
  }

  async getNgrokConfig() {
    try {
      // Get ngrok config file path
      const configPath = path.join(os.homedir(), '.ngrok2', 'ngrok.yml');
      
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        const authtokenMatch = content.match(/authtoken:\s*(.+)/);
        
        return {
          authtoken: authtokenMatch ? authtokenMatch[1].trim() : undefined,
          configPath
        };
      }
      
      return {};
    } catch (error) {
      console.error('Error reading ngrok config:', error);
      return {};
    }
  }

  reportProgress(progress) {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}

module.exports = DependencyManager;