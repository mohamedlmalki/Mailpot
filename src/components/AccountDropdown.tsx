import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from './ui/button';
import { Building, PlusCircle, Trash, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from './ui/use-toast';
import { useAccount, Account } from '@/contexts/AccountContext';
import { useJob } from '@/contexts/JobContext';

const AccountDropdown = () => {
  const { accounts, selectedAccount, setSelectedAccount, addAccount, deleteAccount, validateKey } = useAccount();
  const { jobs } = useJob();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [statusDialogMessage, setStatusDialogMessage] = useState('');
  
  // New State for MailPoet/WP fields
  const [newAccountName, setNewAccountName] = useState('');
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newAppPassword, setNewAppPassword] = useState('');
  
  const [isTestingKey, setIsTestingKey] = useState(false);
  const { toast } = useToast();

  const handleAddAccount = async () => {
    if (!newAccountName || !newSiteUrl || !newUsername || !newAppPassword) {
      toast({ title: "Error", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    try {
      await addAccount(newAccountName, newSiteUrl, newUsername, newAppPassword);
      setNewAccountName('');
      setNewSiteUrl('');
      setNewUsername('');
      setNewAppPassword('');
      setIsAddDialogOpen(false);
    } catch (error) {
       toast({ title: "Error", description: "Could not save account.", variant: "destructive" });
    }
  };

  const handleDelete = async (e: React.MouseEvent, accountId: string) => {
    e.stopPropagation();
    try {
      await deleteAccount(accountId);
    } catch (error) {
      toast({ title: "Error", description: "Could not delete account.", variant: "destructive" });
    }
  }

  const handleValidateKey = async (e: React.MouseEvent, account: Account) => {
    e.stopPropagation();
    setIsTestingKey(true);
    setStatusDialogMessage('Connecting to WordPress...');
    setIsStatusDialogOpen(true);

    try {
      const updatedAccount = await validateKey(account);
      setStatusDialogMessage(updatedAccount.validationMessage || '{}');
      toast({ title: "Validation Complete", description: `Connection is ${updatedAccount.status}.` });
    } catch (error) {
      setStatusDialogMessage('Failed to validate connection.');
      toast({ title: "Error", description: "Could not validate connection.", variant: "destructive" });
    } finally {
      setIsTestingKey(false);
    }
  };

  const getStatusIcon = (status: Account['status']) => {
    if (status === 'valid') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'invalid') return <XCircle className="h-5 w-5 text-red-500" />;
    return null;
  };
  
  const getJobStatusText = (job: any) => {
    if (!job) return null;
    const total = job.emailList.length;
    let statusText = '';
    if (job.isRunning && job.isPaused) statusText = 'Paused';
    else if (job.isRunning) statusText = 'Processing';
    else if (!job.isRunning && job.currentIndex > 0 && job.currentIndex >= total) statusText = 'Finished';
    else if (!job.isRunning && job.currentIndex > 0) statusText = 'Stopped';
    
    if (statusText) {
        return <span className="text-xs text-muted-foreground ml-2">{`${job.currentIndex}/${total} ${statusText}`}</span>;
    }
    return null;
  };

  const selectedAccountJob = selectedAccount ? jobs[selectedAccount.id] : null;

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-start flex-1 h-auto py-2">
              <Building className="mr-2 h-4 w-4 shrink-0" />
              <div className="flex flex-col items-start">
                <span className="font-medium">{selectedAccount ? selectedAccount.name : 'Select Account'}</span>
                {getJobStatusText(selectedAccountJob)}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <DropdownMenuLabel>My Websites</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accounts.map((account) => {
                const job = jobs[account.id];
                return (
                    <DropdownMenuItem key={account.id} onSelect={() => setSelectedAccount(account)} className="flex justify-between items-center">
                        <div className="flex flex-col items-start">
                            <span>{account.name}</span>
                            {getJobStatusText(job)}
                        </div>
                        <div className="flex items-center gap-2">
                            {account.status !== 'unchecked' && (
                                <div onClick={(e) => handleValidateKey(e, account)} className="cursor-pointer p-1 hover:bg-accent rounded-full">
                                    {getStatusIcon(account.status)}
                                </div>
                            )}
                            <Trash className="h-4 w-4 text-muted-foreground hover:text-destructive cursor-pointer" onClick={(e) => handleDelete(e, account.id)}/>
                        </div>
                    </DropdownMenuItem>
                );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setIsAddDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add WordPress Site
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedAccount && selectedAccount.status !== 'unchecked' && (
          <Button variant="ghost" size="icon" onClick={(e) => handleValidateKey(e, selectedAccount)}>
            {isTestingKey ? <Loader2 className="h-5 w-5 animate-spin" /> : getStatusIcon(selectedAccount.status)}
          </Button>
        )}
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add WordPress Site</DialogTitle>
                <DialogDescription>
                    Connect to a WordPress site with the MailPoet API plugin installed.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" placeholder="My Blog" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="col-span-3"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="url" className="text-right">Site URL</Label>
                    <Input id="url" placeholder="https://example.com" value={newSiteUrl} onChange={(e) => setNewSiteUrl(e.target.value)} className="col-span-3"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="user" className="text-right">Username</Label>
                    <Input id="user" placeholder="admin" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="col-span-3"/>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="pass" className="text-right">App Pass</Label>
                    <Input id="pass" type="password" placeholder="xxxx xxxx xxxx xxxx" value={newAppPassword} onChange={(e) => setNewAppPassword(e.target.value)} className="col-span-3"/>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleAddAccount}>Connect Site</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
       <DialogContent>
          <DialogHeader>
            <DialogTitle>Connection Status</DialogTitle>
          </DialogHeader>
          <div className="py-4 font-mono bg-muted p-4 rounded-md text-sm">
            {isTestingKey ? (
              <div className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <p>{statusDialogMessage}</p>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-all">
                {statusDialogMessage}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AccountDropdown;