/**
 * ConnectGTM Component
 * Premium modal-based GTM connection with elegant UX
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGTMAuth } from '../../hooks/useGTMAuth';
import { validateGTMStructure } from '../../utils/gtmValidator';
import { 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  AlertCircle,
  Building2,
  Box,
  X,
  RefreshCw,
  Check,
  Shield,
  Search
} from 'lucide-react';
import './ConnectGTM.css';

// Google "G" Logo
const GoogleLogo = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export const ConnectGTM = ({ onContainerLoaded, onCancel, autoOpenAfterLogin = false }) => {
  const {
    login,
    logout,
    isLoading,
    error,
    accounts,
    fetchContainers,
    fetchContainerVersion,
    isAuthenticated,
    clearError
  } = useGTMAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [step, setStep] = useState('accounts'); // accounts | containers
  const [containers, setContainers] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [loadingContainer, setLoadingContainer] = useState(null);
  const [searchAccount, setSearchAccount] = useState('');
  const [searchContainer, setSearchContainer] = useState('');
  const [localError, setLocalError] = useState(null); // For validation errors
  
  // Track previous accounts count to detect fresh login
  const prevAccountsCount = useRef(accounts.length);

  // Filtered lists
  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchAccount.toLowerCase()) ||
    acc.accountId.includes(searchAccount)
  );
  
  const filteredContainers = containers.filter(cont => 
    cont.name.toLowerCase().includes(searchContainer.toLowerCase()) ||
    cont.publicId?.toLowerCase().includes(searchContainer.toLowerCase())
  );

  // Auto-open modal ONLY after fresh login (accounts changes from 0 to > 0)
  // and ONLY if autoOpenAfterLogin prop is true
  useEffect(() => {
    const justLoggedIn = prevAccountsCount.current === 0 && accounts.length > 0;
    prevAccountsCount.current = accounts.length;
    
    if (autoOpenAfterLogin && justLoggedIn && isAuthenticated && !isModalOpen) {
      setIsModalOpen(true);
      setStep('accounts');
    }
  }, [isAuthenticated, accounts, autoOpenAfterLogin]);

  const handleButtonClick = () => {
    if (isAuthenticated && accounts.length > 0) {
      setIsModalOpen(true);
      setStep('accounts');
    } else {
      login();
    }
  };

  const handleAccountSelect = async (account) => {
    setSelectedAccount(account);
    const containerList = await fetchContainers(account.accountId);
    setContainers(containerList);
    setStep('containers');
  };

  const handleContainerSelect = async (container) => {
    setLoadingContainer(container.containerId);
    setLocalError(null);
    
    try {
      const data = await fetchContainerVersion(container.path);
      if (data) {
        // Validate the API response structure
        const containerData = { containerVersion: data };
        const validation = validateGTMStructure(containerData);
        
        if (!validation.valid) {
          setLocalError(`Google API response may have changed: ${validation.errorDetails}`);
          return;
        }
        
        setIsModalOpen(false);
        onContainerLoaded({
          exportFormatVersion: 2,
          containerVersion: data
        });
      }
    } catch (err) {
      // Handle unexpected errors gracefully
      if (err.message?.includes('undefined') || err.message?.includes('Cannot read')) {
        setLocalError('Google API response format may have changed. Please try again or use file upload.');
      } else {
        setLocalError(err.message || 'Failed to load container');
      }
    } finally {
      setLoadingContainer(null);
    }
  };

  const handleBack = () => {
    if (step === 'containers') {
      setStep('accounts');
      setContainers([]);
      setSelectedAccount(null);
      setSearchContainer('');
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setStep('accounts');
    setContainers([]);
    setSelectedAccount(null);
    setSearchAccount('');
    setSearchContainer('');
    clearError();
    setLocalError(null);
  };

  const handleDisconnect = () => {
    logout();
    handleClose();
    if (onCancel) onCancel();
  };

  // Render Modal Content
  const renderModalContent = () => {
    if (step === 'accounts') {
      return (
        <>
          {/* Header */}
          <div className="gtm-modal-header">
            <div className="modal-title-row">
              <h3>Select GTM Account</h3>
              <button className="modal-close-btn" onClick={handleClose}>
                <X size={18} />
              </button>
            </div>
            <p className="modal-subtitle">Choose the account containing your container</p>
          </div>

          {/* Progress */}
          <div className="gtm-modal-progress">
            <div className="progress-step done">
              <div className="step-circle"><Check size={12} /></div>
              <span>Sign In</span>
            </div>
            <div className="progress-connector done"></div>
            <div className="progress-step active">
              <div className="step-circle">2</div>
              <span>Account</span>
            </div>
            <div className="progress-connector"></div>
            <div className="progress-step">
              <div className="step-circle">3</div>
              <span>Container</span>
            </div>
          </div>

          {/* Error */}
          {(error || localError) && (
            <div className="gtm-modal-error">
              <AlertCircle size={14} />
              <span>{error || localError}</span>
              <button onClick={() => { clearError(); setLocalError(null); }}><X size={12} /></button>
            </div>
          )}

          {/* Content */}
          <div className="gtm-modal-content">
            {isLoading ? (
              <div className="modal-loading">
                <Loader2 size={28} className="spin" />
                <span>Loading accounts...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="modal-empty">
                <p>No GTM accounts found</p>
                <button onClick={() => login()}>
                  <RefreshCw size={14} /> Try again
                </button>
              </div>
            ) : (
              <>
                {accounts.length > 3 && (
                  <div className="modal-search">
                    <Search size={15} />
                    <input 
                      type="text"
                      placeholder="Search accounts..."
                      value={searchAccount}
                      onChange={(e) => setSearchAccount(e.target.value)}
                      autoFocus
                    />
                    {searchAccount && (
                      <button onClick={() => setSearchAccount('')}><X size={14} /></button>
                    )}
                  </div>
                )}
                <div className="modal-count">
                  {searchAccount 
                    ? `${filteredAccounts.length} of ${accounts.length} accounts`
                    : `${accounts.length} account${accounts.length !== 1 ? 's' : ''} found`
                  }
                </div>
                <div className="modal-list">
                  {filteredAccounts.length === 0 ? (
                    <div className="modal-no-match">No accounts match "{searchAccount}"</div>
                  ) : (
                    filteredAccounts.map((account) => (
                      <button
                        key={account.accountId}
                        className="modal-item"
                        onClick={() => handleAccountSelect(account)}
                      >
                        <div className="item-icon">
                          <Building2 size={18} />
                        </div>
                        <div className="item-content">
                          <span className="item-name">{account.name}</span>
                          <span className="item-meta">ID: {account.accountId}</span>
                        </div>
                        <ChevronRight size={18} className="item-arrow" />
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="gtm-modal-footer">
            <div className="footer-security">
              <Shield size={12} />
              <span>Secured by Google OAuth 2.0</span>
            </div>
            <button className="footer-disconnect" onClick={handleDisconnect}>
              Sign out
            </button>
          </div>
        </>
      );
    }

    // Containers step
    return (
      <>
        {/* Header */}
        <div className="gtm-modal-header">
          <div className="modal-title-row">
            <button className="modal-back-btn" onClick={handleBack}>
              <ChevronLeft size={18} />
            </button>
            <h3>Select Container</h3>
            <button className="modal-close-btn" onClick={handleClose}>
              <X size={18} />
            </button>
          </div>
          <div className="modal-breadcrumb">
            <Building2 size={12} />
            <span>{selectedAccount?.name}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="gtm-modal-progress">
          <div className="progress-step done">
            <div className="step-circle"><Check size={12} /></div>
            <span>Sign In</span>
          </div>
          <div className="progress-connector done"></div>
          <div className="progress-step done">
            <div className="step-circle"><Check size={12} /></div>
            <span>Account</span>
          </div>
          <div className="progress-connector done"></div>
          <div className="progress-step active">
            <div className="step-circle">3</div>
            <span>Container</span>
          </div>
        </div>

        {/* Error */}
        {(error || localError) && (
          <div className="gtm-modal-error">
            <AlertCircle size={14} />
            <span>{error || localError}</span>
            <button onClick={() => { clearError(); setLocalError(null); }}><X size={12} /></button>
          </div>
        )}

        {/* Content */}
        <div className="gtm-modal-content">
          {isLoading && !loadingContainer ? (
            <div className="modal-loading">
              <Loader2 size={28} className="spin" />
              <span>Loading containers...</span>
            </div>
          ) : containers.length === 0 ? (
            <div className="modal-empty">
              <p>No containers in this account</p>
              <button onClick={handleBack}>
                <ChevronLeft size={14} /> Back
              </button>
            </div>
          ) : (
            <>
              {containers.length > 3 && (
                <div className="modal-search">
                  <Search size={15} />
                  <input 
                    type="text"
                    placeholder="Search containers..."
                    value={searchContainer}
                    onChange={(e) => setSearchContainer(e.target.value)}
                    autoFocus
                  />
                  {searchContainer && (
                    <button onClick={() => setSearchContainer('')}><X size={14} /></button>
                  )}
                </div>
              )}
              <div className="modal-count">
                {searchContainer 
                  ? `${filteredContainers.length} of ${containers.length} containers`
                  : `${containers.length} container${containers.length !== 1 ? 's' : ''} found`
                }
              </div>
              <div className="modal-list">
                {filteredContainers.length === 0 ? (
                  <div className="modal-no-match">No containers match "{searchContainer}"</div>
                ) : (
                  filteredContainers.map((container) => (
                    <button
                      key={container.containerId}
                      className={`modal-item ${loadingContainer === container.containerId ? 'loading' : ''}`}
                      onClick={() => !loadingContainer && handleContainerSelect(container)}
                      disabled={loadingContainer !== null}
                    >
                      <div className="item-icon container">
                        <Box size={18} />
                      </div>
                      <div className="item-content">
                        <span className="item-name">{container.name}</span>
                        <span className="item-meta">{container.publicId}</span>
                      </div>
                      {loadingContainer === container.containerId ? (
                        <Loader2 size={18} className="spin item-arrow" />
                      ) : (
                        <ChevronRight size={18} className="item-arrow" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="gtm-modal-footer">
          <div className="footer-security">
            <Shield size={12} />
            <span>Secured by Google OAuth 2.0</span>
          </div>
          <button className="footer-disconnect" onClick={handleDisconnect}>
            Sign out
          </button>
        </div>
      </>
    );
  };

  return (
    <>
      {/* Google Sign-in Button */}
      <div className={`gtm-auth-section ${isAuthenticated ? 'connected' : ''}`}>
        <button 
          className="google-auth-btn"
          onClick={handleButtonClick}
          disabled={isLoading}
          title={isAuthenticated ? "Switch container or sign out" : "Connect via Google"}
        >
          <span className="google-icon-wrap">
            {isLoading ? <Loader2 size={18} className="spin" /> : <GoogleLogo size={18} />}
            {isAuthenticated && !isLoading && <span className="connected-indicator"></span>}
          </span>
          <span className="google-btn-text">
            {isLoading ? 'Connecting...' : 'Sign in with Google'}
          </span>
        </button>
        
        {(error || localError) && !isModalOpen && (
          <div className="auth-error-inline">
            <AlertCircle size={14} />
            <span>{error || localError}</span>
          </div>
        )}
        
        <div className="auth-trust">
          <Shield size={12} />
          <span>Secure • Read-only • No data stored</span>
        </div>
      </div>

      {/* Modal Portal */}
      {isModalOpen && createPortal(
        <div className="gtm-modal-overlay" onClick={handleClose}>
          <div className="gtm-modal" onClick={e => e.stopPropagation()}>
            {renderModalContent()}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ConnectGTM;
