import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  FileText, 
  Link, 
  Bell, 
  Palette, 
  MessageCircle, 
  Save,
  Eye,
  EyeOff,
  Lock
} from "lucide-react";

interface AdminSettings {
  content: {
    disclaimer: string;
    aboutUs: string;
    discordLink: string;
    telegramLink: string;
  };
  features: {
    announcementBar: {
      enabled: boolean;
      text: string;
    };
    floatingButtons: {
      enabled: boolean;
      discordLink: string;
      telegramLink: string;
    };
  };
  ads: {
    mainPage: {
      enabled: boolean;
      spots: number;
    };
    searchPage: {
      enabled: boolean;
      spots: number;
    };
    moviesPage: {
      enabled: boolean;
      spots: number;
    };
    showsPage: {
      enabled: boolean;
      spots: number;
    };
    playerPage: {
      enabled: boolean;
      spots: number;
    };
  };
}

const Admin: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState<AdminSettings>({
    content: {
      disclaimer: 'This is a streaming platform for entertainment purposes only.',
      aboutUs: 'Cinema.fo is your premier destination for streaming movies and TV shows.',
      discordLink: 'https://discord.gg/cinema-fo',
      telegramLink: 'https://t.me/cinema-fo'
    },
    features: {
      announcementBar: {
        enabled: false,
        text: 'Welcome to Cinema.fo - Your premium streaming destination!'
      },
      floatingButtons: {
        enabled: true,
        discordLink: 'https://discord.gg/cinema-fo',
        telegramLink: 'https://t.me/cinema-fo'
      }
    },
    ads: {
      mainPage: { enabled: false, spots: 3 },
      searchPage: { enabled: false, spots: 2 },
      moviesPage: { enabled: false, spots: 2 },
      showsPage: { enabled: false, spots: 2 },
      playerPage: { enabled: false, spots: 1 }
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSettings = localStorage.getItem('adminSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error loading admin settings:', error);
      }
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'password') {
      setIsAuthenticated(true);
      setPassword('');
      setSaveMessage('Login successful!');
      setTimeout(() => setSaveMessage(''), 3000);
    } else {
      setSaveMessage('Invalid credentials!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage
      localStorage.setItem('adminSettings', JSON.stringify(settings));
      
      // In a real app, you'd save to backend here
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Error saving settings!');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current: any = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>Enter your credentials to access the admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Login
              </Button>
              {saveMessage && (
                <p className={`text-sm text-center ${saveMessage.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                  {saveMessage}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
//admin side 
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-gray-300">Manage your site content and settings</p>
          </div>
          <Button 
            onClick={() => setIsAuthenticated(false)}
            variant="outline"
            className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
          >
            Logout
          </Button>
        </div>

        <Tabs defaultValue="content" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800">
            <TabsTrigger value="content" className="data-[state=active]:bg-blue-600">
              <FileText className="w-4 h-4 mr-2" />
              Content
            </TabsTrigger>
            <TabsTrigger value="features" className="data-[state=active]:bg-blue-600">
              <Settings className="w-4 h-4 mr-2" />
              Features
            </TabsTrigger>
            <TabsTrigger value="ads" className="data-[state=active]:bg-blue-600">
              <Palette className="w-4 h-4 mr-2" />
              Ads
            </TabsTrigger>
            <TabsTrigger value="social" className="data-[state=active]:bg-blue-600">
              <MessageCircle className="w-4 h-4 mr-2" />
              Social
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Content Management</CardTitle>
                <CardDescription className="text-gray-300">
                  Update your site's content and legal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="disclaimer" className="text-white">Disclaimer</Label>
                  <Textarea
                    id="disclaimer"
                    value={settings.content.disclaimer}
                    onChange={(e) => updateSettings('content.disclaimer', e.target.value)}
                    placeholder="Enter your site disclaimer..."
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="aboutUs" className="text-white">About Us</Label>
                  <Textarea
                    id="aboutUs"
                    value={settings.content.aboutUs}
                    onChange={(e) => updateSettings('content.aboutUs', e.target.value)}
                    placeholder="Enter your about us text..."
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Feature Toggles</CardTitle>
                <CardDescription className="text-gray-300">
                  Enable or disable site features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Announcement Bar</Label>
                    <p className="text-sm text-gray-400">Show a banner at the top of the site</p>
                  </div>
                  <Switch
                    checked={settings.features.announcementBar.enabled}
                    onCheckedChange={(checked) => updateSettings('features.announcementBar.enabled', checked)}
                  />
                </div>
                {settings.features.announcementBar.enabled && (
                  <div>
                    <Label htmlFor="announcementText" className="text-white">Announcement Text</Label>
                    <Input
                      id="announcementText"
                      value={settings.features.announcementBar.text}
                      onChange={(e) => updateSettings('features.announcementBar.text', e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                )}
                <Separator className="bg-gray-600" />
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Floating Social Buttons</Label>
                    <p className="text-sm text-gray-400">Show Discord and Telegram buttons on desktop</p>
                  </div>
                  <Switch
                    checked={settings.features.floatingButtons.enabled}
                    onCheckedChange={(checked) => updateSettings('features.floatingButtons.enabled', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ads" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Advertisement Settings</CardTitle>
                <CardDescription className="text-gray-300">
                  Configure ad placements across your site
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(settings.ads).map(([page, config]) => (
                  <div key={page} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-white capitalize">{page.replace(/([A-Z])/g, ' $1')} Ads</Label>
                        <p className="text-sm text-gray-400">Enable ads on {page.replace(/([A-Z])/g, ' $1').toLowerCase()} page</p>
                      </div>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(checked) => updateSettings(`ads.${page}.enabled`, checked)}
                      />
                    </div>
                    {config.enabled && (
                      <div>
                        <Label htmlFor={`${page}Spots`} className="text-white">Number of Ad Spots</Label>
                        <Input
                          id={`${page}Spots`}
                          type="number"
                          min="1"
                          max="10"
                          value={config.spots}
                          onChange={(e) => updateSettings(`ads.${page}.spots`, parseInt(e.target.value))}
                          className="bg-gray-700 border-gray-600 text-white w-32"
                        />
                      </div>
                    )}
                    <Separator className="bg-gray-600" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Social Media Links</CardTitle>
                <CardDescription className="text-gray-300">
                  Update your social media and community links
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="discordLink" className="text-white">Discord Link</Label>
                  <Input
                    id="discordLink"
                    value={settings.content.discordLink}
                    onChange={(e) => updateSettings('content.discordLink', e.target.value)}
                    placeholder="https://discord.gg/your-server"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="telegramLink" className="text-white">Telegram Link</Label>
                  <Input
                    id="telegramLink"
                    value={settings.content.telegramLink}
                    onChange={(e) => updateSettings('content.telegramLink', e.target.value)}
                    placeholder="https://t.me/your-channel"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                {settings.features.floatingButtons.enabled && (
                  <>
                    <Separator className="bg-gray-600" />
                    <div>
                      <Label htmlFor="floatingDiscord" className="text-white">Floating Discord Link</Label>
                      <Input
                        id="floatingDiscord"
                        value={settings.features.floatingButtons.discordLink}
                        onChange={(e) => updateSettings('features.floatingButtons.discordLink', e.target.value)}
                        placeholder="https://discord.gg/your-server"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="floatingTelegram" className="text-white">Floating Telegram Link</Label>
                      <Input
                        id="floatingTelegram"
                        value={settings.features.floatingButtons.telegramLink}
                        onChange={(e) => updateSettings('features.floatingButtons.telegramLink', e.target.value)}
                        placeholder="https://t.me/your-channel"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-end">
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {saveMessage && (
          <div className={`mt-4 p-4 rounded-lg ${
            saveMessage.includes('Error') 
              ? 'bg-red-500/20 border border-red-500/30 text-red-400' 
              : 'bg-green-500/20 border border-green-500/30 text-green-400'
          }`}>
            {saveMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin; 