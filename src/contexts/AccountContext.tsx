import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useToast } from '@/components/ui/use-toast';
import { useJob } from './JobContext';

export interface Account {
  id: string;
  name: string;
  siteUrl: string;
  username: string;
  appPassword?: string; // Optional in frontend type if we want to hide it, but useful for auth check
  status: 'valid' | 'invalid' | 'unchecked';
  validationMessage?: string;
}

interface AccountContextType {
  accounts: Account[];
  selectedAccount: Account | null;
  setSelectedAccount: (account: Account | null) => void;
  fetchAccounts: () => void;
  addAccount: (name: string, siteUrl: string, username: string, appPassword: string) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  validateKey: (account: Account) => Promise<Account>;
  isLoading: boolean;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
};

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { clearJobForAccount } = useJob();
  const API_URL = 'http://localhost:5008/api/accounts';

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(API_URL);
      setAccounts(response.data);
      if (response.data.length > 0) {
        const storedAccountId = localStorage.getItem('selectedAccountId');
        const foundAccount = response.data.find((acc: Account) => acc.id === storedAccountId);
        setSelectedAccount(foundAccount || response.data[0]);
      } else {
        setSelectedAccount(null);
      }
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch accounts. Is backend running?", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      localStorage.setItem('selectedAccountId', selectedAccount.id);
    } else {
      localStorage.removeItem('selectedAccountId');
    }
  }, [selectedAccount]);

  const addAccount = async (name: string, siteUrl: string, username: string, appPassword: string) => {
    const response = await axios.post(API_URL, { name, siteUrl, username, appPassword });
    const newAccount = response.data;
    setAccounts(prev => [...prev, newAccount]);
    setSelectedAccount(newAccount);
    
    if (newAccount.status === 'valid') {
      toast({ title: "Success", description: "Connected to WordPress successfully!" });
    } else {
      toast({ title: "Warning", description: "Account added, but connection failed.", variant: "destructive" });
    }
  };

  const deleteAccount = async (accountId: string) => {
    await axios.delete(`${API_URL}/${accountId}`);
    toast({ title: "Success", description: "Account deleted." });
    
    clearJobForAccount(accountId);

    const remainingAccounts = accounts.filter(acc => acc.id !== accountId);
    setAccounts(remainingAccounts);
    if (selectedAccount?.id === accountId) {
      setSelectedAccount(remainingAccounts.length > 0 ? remainingAccounts[0] : null);
    }
  };

  const validateKey = async (account: Account) => {
    const response = await axios.put(`${API_URL}/${account.id}/validate`);
    const updatedAccount = response.data;
    const updatedAccounts = accounts.map(acc => (acc.id === updatedAccount.id ? updatedAccount : acc));
    setAccounts(updatedAccounts);
    if (selectedAccount?.id === updatedAccount.id) {
      setSelectedAccount(updatedAccount);
    }
    return updatedAccount;
  };

  return (
    <AccountContext.Provider value={{ accounts, selectedAccount, setSelectedAccount, fetchAccounts, addAccount, deleteAccount, validateKey, isLoading }}>
      {children}
    </AccountContext.Provider>
  );
};