import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import logoPath from "@assets/FJ Brand Logo_1759502325451.png";

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitationToken, setInvitationToken] = useState('');
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const { toast } = useToast();

  // Check for invitation token and session expired flag in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setInvitationToken(token);
      setActiveTab('signup');
    }
    
    // Check if redirected due to session expiry
    if (params.get('session_expired') === 'true') {
      setSessionExpired(true);
      // Clear the URL parameter without reload
      window.history.replaceState({}, '', '/auth');
    }
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate invitation token first
      if (!invitationToken) {
        toast({
          title: 'Invitation Required',
          description: 'You need a valid invitation to sign up. Please contact an administrator.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Validate invitation token with backend
      const validateResponse = await fetch(`/api/validate-invitation?token=${invitationToken}`);
      const validateData = await validateResponse.json();

      if (!validateData.valid) {
        toast({
          title: 'Invalid Invitation',
          description: 'Your invitation token is invalid or has expired.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Ensure email matches invitation
      if (validateData.email && email !== validateData.email) {
        toast({
          title: 'Email Mismatch',
          description: `This invitation is for ${validateData.email}. Please use that email address.`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Validate password strength
      if (password.length < 8) {
        toast({
          title: 'Weak Password',
          description: 'Password must be at least 8 characters',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      if (!/[a-zA-Z]/.test(password)) {
        toast({
          title: 'Weak Password',
          description: 'Password must contain at least one letter',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      if (!/[0-9]/.test(password)) {
        toast({
          title: 'Weak Password',
          description: 'Password must contain at least one number',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            invitation_token: invitationToken,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Mark invitation as used
        await fetch('/api/use-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: invitationToken, userId: data.user.id }),
        });

        // Show the success screen
        setSignupComplete(true);
      }
    } catch (error: any) {
      toast({
        title: 'Sign Up Failed',
        description: error.message || 'Failed to create account',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Signed in successfully!',
      });
    } catch (error: any) {
      toast({
        title: 'Sign In Failed',
        description: error.message || 'Failed to sign in',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send password reset email');
      }

      setResetEmailSent(true);
      toast({
        title: 'Password Reset Email Sent',
        description: 'If an account exists with this email, you will receive a reset link.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed',
        description: error.message || 'Failed to send password reset email',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <img src={logoPath} alt="Rural Support Scheme Logo" className="w-40 object-contain" data-testid="img-logo" />
        </div>
        {sessionExpired && (
          <Alert className="mb-4 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Your session has expired. Please sign in again to continue.
            </AlertDescription>
          </Alert>
        )}
        
        <Card className="bg-transparent border-0 shadow-none">
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'signin' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" data-testid="tab-signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* Sign In Tab */}
            <TabsContent value="signin" className="min-h-[280px]">
              {showForgotPassword ? (
                resetEmailSent ? (
                  <div className="space-y-4">
                    <Alert>
                      <AlertDescription>
                        We've sent you a password reset link. Please check your email and follow the instructions to reset your password.
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetEmailSent(false);
                      }}
                      data-testid="button-back-to-signin"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(false)}
                        className="flex items-center text-sm text-gray-500 hover:text-gray-700"
                        data-testid="button-back-link"
                      >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back to Sign In
                      </button>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="your.email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10"
                          required
                          data-testid="input-reset-email"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading}
                      data-testid="button-send-reset"
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Reset Link
                    </Button>
                    <p className="text-sm text-gray-500 text-center">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                  </form>
                )
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        data-testid="input-signin-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="signin-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-sm text-primary hover:underline"
                        data-testid="link-forgot-password"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signin-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                        data-testid="input-signin-password"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                    data-testid="button-signin"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              )}
            </TabsContent>

            {/* Sign Up Tab */}
            <TabsContent value="signup" className="min-h-[280px]">
              {signupComplete ? (
                <div className="space-y-6 text-center py-4">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900">Account Created Successfully!</h3>
                    <p className="text-gray-600">
                      Welcome to the Rural Support Scheme Portal.
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Important:</strong> Before attempting to login, please confirm your account details by clicking the link in the email sent to you.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSignupComplete(false);
                      setEmail('');
                      setPassword('');
                      setFirstName('');
                      setLastName('');
                    }}
                    data-testid="button-back-to-signin-from-signup"
                  >
                    Go to Sign In
                  </Button>
                </div>
              ) : !invitationToken ? (
                <Alert>
                  <AlertDescription>
                    You need an invitation to sign up. Please contact an administrator or check your email for an invitation link.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="firstName"
                          type="text"
                          placeholder="John"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="pl-10"
                          required
                          data-testid="input-firstname"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        type="text"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        data-testid="input-lastname"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        data-testid="input-signup-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                        minLength={8}
                        data-testid="input-signup-password"
                      />
                    </div>
                    <p className="text-sm text-gray-500">Minimum 8 characters with letters and numbers</p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                    data-testid="button-signup"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              )}
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
