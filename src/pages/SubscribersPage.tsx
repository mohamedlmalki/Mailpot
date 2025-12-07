import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Trash2, AlertTriangle, Terminal, Loader2, User, RefreshCcw } from 'lucide-react';

import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Subscriber {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: string;
}

const SubscribersPage = () => {
  const { selectedAccount } = useAccount();
  
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  // --- FETCH DATA ---
  const fetchSubscribers = async (reset = false) => {
    if (!selectedAccount) return;
    
    setIsLoading(true);
    const currentOffset = reset ? 0 : offset;
    
    try {
      const res = await axios.get(`http://localhost:5006/api/all-subscribers`, {
        params: { 
          accountId: selectedAccount.id, 
          limit: 50,
          offset: currentOffset 
        }
      });
      
      const newData = res.data.data || [];
      
      if (reset) {
        setSubscribers(newData);
        setOffset(50);
      } else {
        setSubscribers(prev => [...prev, ...newData]);
        setOffset(prev => prev + 50);
      }

      if (newData.length < 50) setHasMore(false);
      else setHasMore(true);

    } catch (error: any) {
      console.error(error);
      toast.error('Failed to load subscribers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccount) {
        fetchSubscribers(true);
        setSelectedEmails(new Set());
    } else {
        setSubscribers([]);
    }
  }, [selectedAccount]);

  // --- SELECTION LOGIC ---
  const toggleSelect = (email: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(email)) newSelected.delete(email);
    else newSelected.add(email);
    setSelectedEmails(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedEmails.size === subscribers.length) {
        setSelectedEmails(new Set());
    } else {
        setSelectedEmails(new Set(subscribers.map(s => s.email)));
    }
  };

  // --- DELETE LOGIC ---
  const handleDelete = async () => {
    if (selectedEmails.size === 0) return;
    
    if (!confirm(`Are you sure you want to permanently delete ${selectedEmails.size} subscriber(s)?`)) return;

    setIsDeleting(true);
    const emailsToDelete = Array.from(selectedEmails);
    let successCount = 0;

    // Process in parallel chunks of 5 to be faster but safe
    const chunkSize = 5;
    for (let i = 0; i < emailsToDelete.length; i += chunkSize) {
        const chunk = emailsToDelete.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (email) => {
            try {
                await axios.delete(`http://localhost:5006/api/subscriber`, {
                    params: { accountId: selectedAccount?.id, email }
                });
                successCount++;
            } catch (e) {
                console.error(`Failed to delete ${email}`);
            }
        }));
    }

    toast.success(`Deleted ${successCount} subscribers.`);
    
    // Refresh list locally
    setSubscribers(prev => prev.filter(s => !selectedEmails.has(s.email)));
    setSelectedEmails(new Set());
    setIsDeleting(false);
  };

  if (!selectedAccount) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>No Account Selected</AlertTitle>
          <AlertDescription>Please select a website from the sidebar.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in relative">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold">Subscribers</h1>
            <p className="text-muted-foreground">Manage list for <strong>{selectedAccount.name}</strong></p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchSubscribers(true)} disabled={isLoading}>
                <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
            </Button>
            {selectedEmails.size > 0 && (
                <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Delete ({selectedEmails.size})
                </Button>
            )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
            <CardTitle className="text-lg flex justify-between">
                <span>Total Loaded: {subscribers.length}</span>
                <span className="text-sm font-normal text-muted-foreground">
                    {selectedEmails.size} selected
                </span>
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox 
                                    checked={subscribers.length > 0 && selectedEmails.size === subscribers.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {subscribers.length === 0 && !isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                    No subscribers found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            subscribers.map((sub) => (
                                <TableRow key={sub.id} data-state={selectedEmails.has(sub.email) ? "selected" : ""}>
                                    <TableCell>
                                        <Checkbox 
                                            checked={selectedEmails.has(sub.email)}
                                            onCheckedChange={() => toggleSelect(sub.email)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{sub.email}</TableCell>
                                    <TableCell>{sub.first_name} {sub.last_name}</TableCell>
                                    <TableCell>
                                        <Badge variant={sub.status === 'subscribed' ? 'default' : 'secondary'}>
                                            {sub.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {sub.created_at}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                            onClick={() => {
                                                if(confirm('Delete this user?')) {
                                                    setSelectedEmails(new Set([sub.email]));
                                                    // Little timeout to let state update before calling delete logic manually or just reuse logic
                                                    // Simpler to just trigger the batch delete for 1 item immediately:
                                                    axios.delete(`http://localhost:5006/api/subscriber`, {
                                                        params: { accountId: selectedAccount.id, email: sub.email }
                                                    }).then(() => {
                                                        toast.success('Deleted');
                                                        setSubscribers(prev => prev.filter(s => s.id !== sub.id));
                                                    }).catch(() => toast.error('Failed'));
                                                }
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {hasMore && (
                <div className="mt-4 text-center">
                    <Button variant="ghost" onClick={() => fetchSubscribers(false)} disabled={isLoading}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Load More
                    </Button>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscribersPage;