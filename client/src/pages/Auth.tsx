import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoginForm from '@/components/Auth/LoginForm';
import SignupForm from '@/components/Auth/SignupForm';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  );

  const handleSuccess = async () => {
    // Check for pending upgrade from pricing page
    const pendingUpgrade = sessionStorage.getItem('pendingUpgrade');
    if (pendingUpgrade) {
      sessionStorage.removeItem('pendingUpgrade');
      console.log('Resuming pending upgrade after auth:', pendingUpgrade);
      
      // Trigger the upgrade flow
      const { handleUpgrade } = await import('@/lib/handleUpgrade');
      await handleUpgrade(pendingUpgrade as 'standard' | 'pro' | 'family');
      return; // Don't navigate - handleUpgrade will redirect to Stripe
    }
    
    // Check for redirect in session storage (from upload page)
    const redirectAfterLogin = sessionStorage.getItem('redirectAfterLogin');
    if (redirectAfterLogin) {
      sessionStorage.removeItem('redirectAfterLogin');
      window.location.href = redirectAfterLogin;
      return;
    }
    
    const redirect = searchParams.get('redirect') || '/upload';
    window.location.href = redirect;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        {mode === 'login' ? (
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToSignup={() => setMode('signup')}
          />
        ) : (
          <SignupForm
            onSuccess={handleSuccess}
            onSwitchToLogin={() => setMode('login')}
          />
        )}
      </div>
    </div>
  );
}
