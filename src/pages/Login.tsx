import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Eye, EyeOff, ShieldCheck, User } from 'lucide-react';

type Role = 'cashier' | 'admin';

export default function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('admin');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const authed = localStorage.getItem('vdw_auth') === 'true';
    if (authed) navigate('/order', { replace: true });
  }, [navigate]);

  const handleCashierLogin = () => {
    setError('');
    localStorage.setItem('vdw_auth', 'true');
    localStorage.setItem('vdw_role', 'cashier');
    navigate('/order');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const correctPin = localStorage.getItem('vdw_pin') || '1234';
    if (pin === correctPin) {
      localStorage.setItem('vdw_auth', 'true');
      localStorage.setItem('vdw_role', 'admin');
      navigate('/order');
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <Seo
        title="Login | Vela Dry Wash POS"
        description="Sign in to Vela Dry Wash POS to create orders and print thermal receipts."
        canonicalPath="/login"
      />

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="bg-primary text-primary-foreground rounded-t-lg py-6">
          <CardTitle className="text-center text-2xl md:text-3xl">Vela Dry Wash</CardTitle>
          <p className="text-center text-xs md:text-sm opacity-90">Admin &amp; Cashier Portal</p>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          {/* Role Selector */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Please enter your PIN to access Dashboard and Settings.
            </p>
            <div className="space-y-2">
              <Label htmlFor="pin">Admin PIN</Label>
              <div className="relative">
                <Input
                  id="pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  placeholder="Enter admin PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPin((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive font-medium">{error}</p>}

            <Button id="admin-login-btn" type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}