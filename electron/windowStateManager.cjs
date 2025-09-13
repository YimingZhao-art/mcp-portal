const fs = require('fs');
const path = require('path');
const os = require('os');

class WindowStateManager {
  constructor() {
    const userDataPath = path.join(os.homedir(), '.mcp-portal');
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    this.statePath = path.join(userDataPath, 'window-state.json');
    this.defaultState = {
      width: 1200,
      height: 800,
      isMaximized: false
    };
  }

  load() {
    try {
      if (fs.existsSync(this.statePath)) {
        const data = fs.readFileSync(this.statePath, 'utf8');
        return { ...this.defaultState, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load window state:', error);
    }
    return this.defaultState;
  }

  save(state) {
    try {
      fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Failed to save window state:', error);
    }
  }
}

module.exports = WindowStateManager;