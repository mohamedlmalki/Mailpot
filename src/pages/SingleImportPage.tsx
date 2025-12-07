import React, { useState, useEffect } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2, Tag } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SystemIoTage {
  id: number;
  name: string;
}

const SingleImportPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [tags, setTags] = useState<SystemIoTage[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  
  const { selectedAccount } = useAccount();

  // Fetch tags when account changes
  useEffect(() => {
    const fetchTags = async () => {
      if (!selectedAccount?.apiKey) {
        setTags([]);
        return;
      }

      setIsLoadingTags(true);
      try {
        // Pass apiKey as query param as defined in backend
        const res = await axios.get(`http://localhost:5006/api/tags?apiKey=${selectedAccount.apiKey}`);
        // System.io returns { items: [...] } usually, but let's handle array directly or wrapped
        const fetchedTags = res.data.items || res.data; 
        setTags(Array.isArray(fetchedTags) ? fetchedTags : []);
      } catch (error) {
        console.error("Failed to fetch tags", error);
        toast.error("Could not load tags from System.io");
      } finally {
        setIsLoadingTags(false);
      }
    };

    fetchTags();
  }, [selectedAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccount) {
      toast.error('Please select an account from the sidebar first.');
      return;
    }

    if (!email.trim()) {
      toast.error('Please enter an email address.');
      return;
    }

    setIsLoading(true);
    setResponse('');
    
    try {
      // 1. Create Contact
      const contactPayload = { email: email };
      const createRes = await axios.post('http://localhost:5006/api/contacts', {
        apiKey: selectedAccount.apiKey,
        ...contactPayload
      });
      
      const newContact = createRes.data;
      let logOutput = `[SUCCESS] Contact Created:\n${JSON.stringify(newContact, null, 2)}`;

      // 2. Assign Tag (if selected)
      if (selectedTagId) {
        // System.io usually returns the contact object which has an 'id' field
        const contactId = newContact.id;
        
        if (contactId) {
          logOutput += `\n\n[INFO] Assigning Tag ID: ${selectedTagId}...`;
          try {
            const tagRes = await axios.post(`http://localhost:5006/api/contacts/${contactId}/tags`, {
              apiKey: selectedAccount.apiKey,
              tagId: parseInt(selectedTagId) // Ensure it's a number/int as per docs
            });
            logOutput += `\n[SUCCESS] Tag Assigned:\n${JSON.stringify(tagRes.data, null, 2)}`;
            toast.success('Subscriber added and tag assigned!');
          } catch (tagError: any) {
            logOutput += `\n[ERROR] Failed to assign tag: ${tagError.response?.data?.message || tagError.message}`;
            toast.warning('Subscriber added, but failed to assign tag.');
          }
        } else {
            logOutput += `\n[WARNING] Could not find Contact ID in response to assign tag.`;
        }
      } else {
        toast.success('Subscriber added successfully!');
      }

      setResponse(logOutput);
      setEmail(''); // Clear the email field
      // We keep the selected tag for convenience, or you could clear it: setSelectedTagId('');

    } catch (error: any) {
      const errorData = error.response?.data || { message: "An unknown error occurred" };
      setResponse(JSON.stringify(errorData, null, 2));
      toast.error(errorData.message || 'Failed to add subscriber.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
       <div className="mb-6">
        <h1 className="text-3xl font-bold">Single Subscriber Import</h1>
        <p className="text-muted-foreground">Add a single contact to your System.io list.</p>
      </div>

      {!selectedAccount && (
        <Alert variant="destructive" className="mb-6">
          <Terminal className="h-4 w-4" />
          <AlertTitle>No Account Selected</AlertTitle>
          <AlertDescription>
            Please select an active account from the dropdown in the sidebar before importing a contact.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Contact</CardTitle>
          <CardDescription>Enter the email address and optionally select a tag.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              
              {/* Email Input */}
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="email">Email Address (Required)</Label>
                <Input 
                  id="email" 
                  placeholder="name@example.com" 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={!selectedAccount || isLoading}
                />
              </div>

              {/* Tag Selection */}
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="tag-select">Assign Tag (Optional)</Label>
                <Select 
                  value={selectedTagId} 
                  onValueChange={setSelectedTagId} 
                  disabled={!selectedAccount || isLoading || isLoadingTags}
                >
                  <SelectTrigger id="tag-select">
                    <SelectValue placeholder={isLoadingTags ? "Loading tags..." : "Select a tag to assign"} />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="no-tag">-- No Tag --</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag.id} value={tag.id.toString()}>
                        {tag.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tags.length === 0 && !isLoadingTags && selectedAccount && (
                   <p className="text-xs text-muted-foreground">No tags found for this account.</p>
                )}
              </div>

              <Button type="submit" disabled={isLoading || !selectedAccount}>
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                    </>
                ) : (
                    'Add Subscriber'
                )}
              </Button>
            </div>
          </form>

          {response && (
            <div className="mt-6">
              <Label>Operation Log</Label>
              <Textarea
                readOnly
                value={response}
                className="mt-2 h-48 font-mono text-xs bg-muted"
                placeholder="API response will be shown here"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SingleImportPage;