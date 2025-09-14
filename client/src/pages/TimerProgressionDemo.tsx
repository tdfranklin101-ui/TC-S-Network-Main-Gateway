import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface UserProfile {
  solarBalance: number;
  totalEarned: number;
  totalSpent: number;
}

interface AccessInfo {
  canAccess: boolean;
  accessType: 'locked' | 'timer_active' | 'timer_complete' | 'preview' | 'full';
  timeRemaining?: number;
  solarCost?: number;
  progression?: any;
  entitlement?: any;
  userBalance?: number;
}

export default function TimerProgressionDemo() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accessInfo, setAccessInfo] = useState<AccessInfo | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const contentType = 'music_track';
  const contentId = 'premium_track_1';

  useEffect(() => {
    checkAccessStatus();
    loadUserProfile();
    
    // Set up timer interval
    const interval = setInterval(() => {
      if (timeRemaining > 0) {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const loadUserProfile = async () => {
    try {
      const response = await fetch('/api/progression/profile', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setProfile(data.profile);
        setIsRegistered(true);
      }
    } catch (error) {
      console.log('User not registered yet');
    }
  };

  const checkAccessStatus = async () => {
    try {
      const response = await fetch(`/api/progression/content/${contentType}/${contentId}/access`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAccessInfo(data);
        if (data.timeRemaining) {
          setTimeRemaining(data.timeRemaining);
        }
      }
    } catch (error) {
      console.error('Error checking access:', error);
    }
  };

  const registerUser = async () => {
    const email = (document.getElementById('email') as HTMLInputElement)?.value;
    const firstName = (document.getElementById('firstName') as HTMLInputElement)?.value;
    const lastName = (document.getElementById('lastName') as HTMLInputElement)?.value;

    if (!email || !firstName || !lastName) {
      toast({
        title: "Registration Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('POST', '/api/progression/register', {
        email,
        firstName,
        lastName
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setProfile(data.profile);
        setIsRegistered(true);
        
        toast({
          title: "Registration Successful!",
          description: `Welcome! You received ${data.profile.solarBalance} Solar as a welcome bonus.`
        });
        
        await checkAccessStatus();
      }
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const startTimer = async () => {
    if (!isRegistered) {
      toast({
        title: "Registration Required",
        description: "Please register to start the timer",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('POST', `/api/progression/content/${contentType}/${contentId}/start-timer`, {
        duration: 60 // 60 seconds
      });

      if (response.ok) {
        const data = await response.json();
        setTimeRemaining(60);
        await checkAccessStatus();
        
        toast({
          title: "Timer Started!",
          description: "Wait 60 seconds to unlock with Solar payment"
        });
      }
    } catch (error) {
      toast({
        title: "Timer Failed",
        description: "Could not start timer",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const unlockWithSolar = async () => {
    if (!isRegistered || !profile || profile.solarBalance < (accessInfo?.solarCost || 0)) {
      toast({
        title: "Insufficient Solar",
        description: `You need ${accessInfo?.solarCost || 0} Solar tokens`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('POST', `/api/progression/content/${contentType}/${contentId}/unlock`);

      if (response.ok) {
        const data = await response.json();
        setProfile({ ...profile, solarBalance: data.newBalance });
        await checkAccessStatus();
        
        toast({
          title: "Content Unlocked!",
          description: `Successfully unlocked for ${accessInfo?.solarCost || 0} Solar tokens`
        });
      }
    } catch (error) {
      toast({
        title: "Unlock Failed",
        description: "Could not unlock content",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              ☀️ Timer-Gated Progression Demo
            </CardTitle>
            <CardDescription className="text-center">
              Complete implementation of timer-gated content progression with Solar economy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Status */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {isRegistered ? (
                    <div className="space-y-2">
                      <p><strong>Email:</strong> {user?.email}</p>
                      <p><strong>Name:</strong> {user?.firstName} {user?.lastName}</p>
                      <p><strong>Solar Balance:</strong> {profile?.solarBalance || 0}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p>Register to unlock timer-gated progression</p>
                      <div className="space-y-2">
                        <input id="email" type="email" placeholder="Email" className="w-full p-2 border rounded" data-testid="input-email" />
                        <input id="firstName" placeholder="First Name" className="w-full p-2 border rounded" data-testid="input-first-name" />
                        <input id="lastName" placeholder="Last Name" className="w-full p-2 border rounded" data-testid="input-last-name" />
                        <Button onClick={registerUser} disabled={loading} className="w-full" data-testid="button-register">
                          {loading ? "Registering..." : "Register & Get 100 Solar"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Content Access</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p><strong>Status:</strong> {accessInfo?.accessType || 'Loading...'}</p>
                    <p><strong>Cost:</strong> {accessInfo?.solarCost || 0} Solar</p>
                    
                    {accessInfo?.accessType === 'timer_active' && (
                      <div className="space-y-2">
                        <p><strong>Time Remaining:</strong> {formatTime(timeRemaining)}</p>
                        <Progress value={((60 - timeRemaining) / 60) * 100} className="w-full" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <Button 
                    onClick={startTimer}
                    disabled={!isRegistered || loading || accessInfo?.accessType === 'timer_active'}
                    variant="outline"
                    data-testid="button-start-timer"
                  >
                    {accessInfo?.accessType === 'timer_active' ? 'Timer Running...' : 'Start Timer'}
                  </Button>
                  
                  <Button 
                    onClick={unlockWithSolar}
                    disabled={!isRegistered || loading || accessInfo?.accessType === 'full' || 
                             (profile?.solarBalance || 0) < (accessInfo?.solarCost || 0)}
                    data-testid="button-unlock-solar"
                  >
                    Unlock with Solar
                  </Button>
                  
                  <Button 
                    onClick={() => window.open('/music-now.html', '_blank')}
                    variant="secondary"
                    data-testid="button-test-music"
                  >
                    Test Music Player
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Status Display */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current State</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 p-4 rounded-lg">
                  <pre className="text-sm">
                    {JSON.stringify({ 
                      isRegistered, 
                      profile, 
                      accessInfo,
                      timeRemaining 
                    }, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}