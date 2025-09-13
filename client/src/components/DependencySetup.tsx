import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Check, X, Loader2, AlertCircle, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';

interface DependencyStatus {
  ngrok: boolean;
  supergateway: boolean;
  brew: boolean;
}

interface InstallProgress {
  total: number;
  current: number;
  currentPackage: string;
  message: string;
}

declare global {
  interface Window {
    electronAPI?: {
      checkDependencies: () => Promise<DependencyStatus>;
      installDependencies: (onProgress: (progress: InstallProgress) => void) => Promise<{ success: boolean }>;
      configureNgrok: (authtoken: string) => Promise<{ success: boolean }>;
      getNgrokConfig: () => Promise<{ authtoken?: string; configPath?: string }>;
    };
  }
}

export const DependencySetup: React.FC = () => {
  const [dependencyStatus, setDependencyStatus] = useState<DependencyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [ngrokToken, setNgrokToken] = useState('');
  const [configuringNgrok, setConfiguringNgrok] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [existingNgrokConfig, setExistingNgrokConfig] = useState<{ authtoken?: string } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    checkDependencies();
    checkNgrokConfig();
  }, []);

  useEffect(() => {
    // Auto-expand if dependencies are missing
    if (dependencyStatus && (!dependencyStatus.ngrok || !dependencyStatus.supergateway)) {
      setIsExpanded(true);
    }
  }, [dependencyStatus]);

  const checkDependencies = async () => {
    if (!window.electronAPI) {
      console.log('Not running in Electron');
      return;
    }

    setLoading(true);
    try {
      const status = await window.electronAPI.checkDependencies();
      setDependencyStatus(status);
    } catch (error) {
      console.error('Error checking dependencies:', error);
      setMessage({ type: 'error', text: 'Failed to check dependencies' });
    } finally {
      setLoading(false);
    }
  };

  const checkNgrokConfig = async () => {
    if (!window.electronAPI) return;

    try {
      const config = await window.electronAPI.getNgrokConfig();
      setExistingNgrokConfig(config);
      if (config.authtoken) {
        setNgrokToken(config.authtoken);
      }
    } catch (error) {
      console.error('Error checking ngrok config:', error);
    }
  };

  const installDependencies = async () => {
    if (!window.electronAPI) return;

    setInstalling(true);
    setMessage(null);
    
    try {
      await window.electronAPI.installDependencies((progress) => {
        setInstallProgress(progress);
      });
      
      setMessage({ type: 'success', text: 'All dependencies installed successfully!' });
      
      // Refresh dependency status
      await checkDependencies();
    } catch (error: any) {
      console.error('Error installing dependencies:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to install dependencies' });
    } finally {
      setInstalling(false);
      setInstallProgress(null);
    }
  };

  const configureNgrok = async () => {
    if (!window.electronAPI || !ngrokToken) return;

    setConfiguringNgrok(true);
    setMessage(null);

    try {
      await window.electronAPI.configureNgrok(ngrokToken);
      setMessage({ type: 'success', text: 'ngrok configured successfully!' });
      await checkNgrokConfig();
    } catch (error: any) {
      console.error('Error configuring ngrok:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to configure ngrok' });
    } finally {
      setConfiguringNgrok(false);
    }
  };

  // Only show in Electron
  if (!window.electronAPI) {
    return null;
  }

  const allDependenciesInstalled = dependencyStatus?.ngrok && dependencyStatus?.supergateway;
  const hasNgrokConfig = !!existingNgrokConfig?.authtoken;

  // Generate status text for header
  const getStatusText = () => {
    if (loading) return 'Checking...';
    if (!dependencyStatus) return '';
    if (allDependenciesInstalled && hasNgrokConfig) return 'All configured';
    if (allDependenciesInstalled) return 'Dependencies installed';
    return 'Setup required';
  };

  const statusText = getStatusText();
  const isFullyConfigured = allDependenciesInstalled && hasNgrokConfig;

  return (
    <Card className="mb-6">
      <CardHeader 
        className="cursor-pointer select-none hover:bg-muted/50 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <CardTitle className="text-base">Dependency Setup</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {statusText && (
              <span className={`text-xs ${isFullyConfigured ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                {statusText}
              </span>
            )}
            {isFullyConfigured && <Check className="h-4 w-4 text-green-600 dark:text-green-400" />}
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
        {/* Dependency Status */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">System Dependencies</h3>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Checking dependencies...</span>
            </div>
          ) : dependencyStatus ? (
            <div className="space-y-1">
              <DependencyItem name="Homebrew" installed={dependencyStatus.brew} required />
              <DependencyItem name="ngrok" installed={dependencyStatus.ngrok} />
              <DependencyItem name="supergateway" installed={dependencyStatus.supergateway} />
            </div>
          ) : null}
        </div>

        {/* Install Dependencies */}
        {dependencyStatus && !dependencyStatus.brew && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Homebrew is required but not installed. Please install it first:{' '}
              <a
                href="https://brew.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                brew.sh
                <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>
        )}

        {dependencyStatus && dependencyStatus.brew && !allDependenciesInstalled && (
          <div>
            <Button
              onClick={installDependencies}
              disabled={installing}
              className="w-full"
            >
              {installing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing Dependencies...
                </>
              ) : (
                'Install Missing Dependencies'
              )}
            </Button>
            
            {installProgress && (
              <div className="mt-3 space-y-2">
                <Progress 
                  value={(installProgress.current / installProgress.total) * 100} 
                  className="h-2"
                />
                <p className="text-sm text-muted-foreground">
                  {installProgress.message}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ngrok Configuration */}
        {allDependenciesInstalled && (
          <div className="space-y-3 pt-4 border-t">
            <h3 className="text-sm font-medium">ngrok Configuration</h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter your ngrok authtoken"
                  value={ngrokToken}
                  onChange={(e) => setNgrokToken(e.target.value)}
                  disabled={configuringNgrok}
                />
                <Button
                  onClick={configureNgrok}
                  disabled={!ngrokToken || configuringNgrok}
                >
                  {configuringNgrok ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Configure'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your authtoken from{' '}
                <a
                  href="https://dashboard.ngrok.com/get-started/your-authtoken"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center gap-1"
                >
                  ngrok dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              {existingNgrokConfig?.authtoken && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  ✓ ngrok is already configured
                </p>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
        </CardContent>
      )}
    </Card>
  );
};

const DependencyItem: React.FC<{ 
  name: string; 
  installed: boolean; 
  required?: boolean;
}> = ({ name, installed, required }) => (
  <div className="flex items-center justify-between py-1">
    <span className="text-sm">{name}</span>
    <div className="flex items-center gap-2">
      {installed ? (
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <X className="h-4 w-4 text-red-600 dark:text-red-400" />
      )}
      <span className="text-xs text-muted-foreground">
        {installed ? 'Installed' : required ? 'Required' : 'Not installed'}
      </span>
    </div>
  </div>
);