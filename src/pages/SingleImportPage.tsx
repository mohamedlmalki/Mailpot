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
import { Terminal, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MailPoetList {
  id: string;
  name: string;
}

const SingleImportPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [lists, setLists] = useState<MailPoetList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  
  const { selectedAccount } = useAccount();

  // Fetch lists when account changes
  useEffect(() => {
    const fetchLists = async () => {
      if (!selectedAccount) {
        setLists([]);
        return;
      }

      setIsLoadingLists(true);
      try {
        const res = await axios.get(`http://localhost:5008/api/lists?accountId=${selectedAccount.id}`);
        const fetchedLists = res.data; 
        setLists(Array.isArray(fetchedLists) ? fetchedLists : []);
      } catch (error) {
        console.error("Failed to fetch lists", error);
        toast.error("Could not load MailPoet lists");
      } finally {
        setIsLoadingLists(false);
      }
    };

    fetchLists();
  }, [selectedAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAccount) {
      toast.error('Please select an account first.');
      return;
    }

    if (!email.trim()) {
      toast.error('Please enter an email address.');
      return;
    }

    setIsLoading(true);
    setResponse('');
    
    try {
      const payload = { 
        accountId: selectedAccount.id,
        email: email,
        list_id: selectedListId !== 'no-list' ? selectedListId : null
      };

      const createRes = await axios.post('http://localhost:5008/api/subscribers', payload);
      
      const subscriber = createRes.data.data; // Wrapper from PHP is { success: true, data: {} }
      
      const logOutput = `[SUCCESS] Subscriber Created:\n${JSON.stringify(subscriber, null, 2)}`;
      setResponse(logOutput);
      toast.success('Subscriber added successfully!');
      setEmail(''); 

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
        <p className="text-muted-foreground">Add a single contact to your MailPoet list.</p>
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
          <CardDescription>Enter the email address and select a list.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              
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

              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="list-select">Assign to List (Optional)</Label>
                <Select 
                  value={selectedListId} 
                  onValueChange={setSelectedListId} 
                  disabled={!selectedAccount || isLoading || isLoadingLists}
                >
                  <SelectTrigger id="list-select">
                    <SelectValue placeholder={isLoadingLists ? "Loading lists..." : "Select a list"} />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="no-list">-- No List --</SelectItem>
                    {lists.map((list) => (
                      <SelectItem key={list.id} value={list.id.toString()}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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