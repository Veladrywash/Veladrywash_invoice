import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, X, LogOut, Settings, LayoutDashboard, ShoppingCart, Download } from 'lucide-react';
import { toast } from 'sonner';

export function NavBar() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.info('To install, click the "App/Install" icon in your browser search address bar, or use the menu toolbar options setups setup framing.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const role = localStorage.getItem('vdw_role') ?? 'cashier';
  const isAdmin = role === 'admin';

  const logout = () => {
    localStorage.removeItem('vdw_auth');
    localStorage.removeItem('vdw_role');
    navigate('/login');
  };

  const navLinks = (
    <>
      <Link
        to="/order"
        className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
        onClick={() => setMenuOpen(false)}
      >
        <ShoppingCart className="w-4 h-4" />
        New Order
      </Link>
      {isAdmin && (
        <>
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-1.5 text-sm font-medium hover:text-primary transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </>
      )}
    </>
  );

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        {/* Brand */}
        <span className="font-bold text-base bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent shrink-0">
          Vela Dry Wash POS
        </span>

        {/* Center nav — desktop */}
        {!isMobile && (
          <div className="flex items-center gap-6">
            {navLinks}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {!isMobile && isInstallable && (
            <Button
              variant="default"
              size="sm"
              onClick={handleInstallClick}
              className="bg-primary hover:bg-accent hover:text-accent-foreground"
            >
              <Download className="w-4 h-4 mr-1" />
              Install
            </Button>
          )}

          {!isMobile && (
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          )}

          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {isMobile && menuOpen && (
        <div className="border-t bg-background px-4 py-3 flex flex-col gap-3 shadow-lg">
          {navLinks}
          {isInstallable && (
            <Button variant="default" size="sm" onClick={handleInstallClick} className="w-full mt-2">
              <Download className="w-4 h-4 mr-2" />
              Install Web App
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={logout} className="w-full mt-1">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      )}
    </nav>
  );
}
