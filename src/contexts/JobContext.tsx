import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import axios from 'axios';

interface ImportResult {
  id: number;
  email: string;
  status: 'pending' | 'success' | 'error';
  details: string;
}

interface Job {
  id: string; // Account ID
  name: string;
  emailList: string[];
  listId?: string; // MailPoet List ID
  results: ImportResult[];
  currentIndex: number;
  isRunning: boolean;
  isPaused: boolean;
  delay: number;
  countdown: number;
  startTime: number | null;
  endTime: number | null;
  pauseTime: number | null;
  totalPausedTime: number;
}

interface JobContextType {
  jobs: Record<string, Job>;
  startJob: (accountId: string, name: string, emails: string, delay: number, listId?: string) => void;
  pauseJob: (accountId: string) => void;
  resumeJob: (accountId: string) => void;
  stopJob: (accountId: string) => void;
  clearJobForAccount: (accountId: string) => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const useJob = () => {
  const context = useContext(JobContext);
  if (!context) {
    throw new Error('useJob must be used within a JobProvider');
  }
  return context;
};

export const JobProvider = ({ children }: { children: ReactNode }) => {
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setJobs(prevJobs => {
        const newJobs = { ...prevJobs };
        let jobsChanged = false;

        Object.keys(newJobs).forEach(accountId => {
          const job = newJobs[accountId];
          if (job.isRunning && !job.isPaused) {
            jobsChanged = true;
            if (job.countdown > 0) {
              job.countdown -= 1;
            } else {
              if (job.currentIndex < job.emailList.length) {
                processQueueItem(job); 
                job.currentIndex += 1;
                job.countdown = job.delay;
              } else {
                job.isRunning = false;
                job.endTime = Date.now();
              }
            }
          }
        });
        return jobsChanged ? newJobs : prevJobs;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);

  const processQueueItem = async (job: Job) => {
    const email = job.emailList[job.currentIndex];
    
    // We send accountId so backend can lookup credentials
    const payload = {
      accountId: job.id,
      email: email,
      list_id: job.listId
    };
    
    let newResult: ImportResult;
    try {
      const response = await axios.post('http://localhost:5008/api/subscribers', payload);
      const details = JSON.stringify(response.data, null, 2);
      newResult = { id: job.currentIndex + 1, email, status: 'success', details };
    } catch (error: any) {
      const errorData = error.response?.data || { 
        message: error.message || "An unknown network error occurred",
        status: error.response?.status
      };
      
      newResult = { 
        id: job.currentIndex + 1, 
        email, 
        status: 'error', 
        details: JSON.stringify(errorData, null, 2) 
      };
    }

    setJobs(prevJobs => ({
      ...prevJobs,
      [job.id]: {
        ...prevJobs[job.id],
        results: [newResult, ...prevJobs[job.id].results]
      }
    }));
  };

  const startJob = (accountId: string, name: string, emails: string, delay: number, listId?: string) => {
    const emailList = emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    if (emailList.length === 0) return;

    setJobs(prevJobs => ({
      ...prevJobs,
      [accountId]: {
        id: accountId, name, emailList, delay,
        listId: listId && listId !== "no-list" ? listId : undefined,
        results: [],
        currentIndex: 0,
        isRunning: true,
        isPaused: false,
        countdown: 0,
        startTime: Date.now(),
        endTime: null,
        pauseTime: null,
        totalPausedTime: 0,
      }
    }));
  };

  const pauseJob = (accountId: string) => {
    setJobs(prevJobs => {
        const job = prevJobs[accountId];
        if (!job || job.isPaused) return prevJobs;
        return {
            ...prevJobs,
            [accountId]: { ...job, isPaused: true, pauseTime: Date.now() }
        };
    });
  };

  const resumeJob = (accountId: string) => {
    setJobs(prevJobs => {
        const job = prevJobs[accountId];
        if (!job || !job.isPaused || !job.pauseTime) return prevJobs;
        const pausedDuration = Date.now() - job.pauseTime;
        return {
            ...prevJobs,
            [accountId]: { 
                ...job, 
                isPaused: false, 
                pauseTime: null,
                totalPausedTime: job.totalPausedTime + pausedDuration
            }
        };
    });
  };
  
  const stopJob = (accountId: string) => {
    setJobs(prevJobs => {
        const job = prevJobs[accountId];
        if (!job) return prevJobs;

        let { totalPausedTime } = job;
        if (job.isPaused && job.pauseTime) {
            totalPausedTime += (Date.now() - job.pauseTime);
        }

        return {
            ...prevJobs,
            [accountId]: {
                ...job,
                isRunning: false,
                isPaused: false,
                endTime: Date.now(),
                pauseTime: null,
                totalPausedTime,
            }
        };
    });
  };

  const clearJobForAccount = (accountId: string) => {
    setJobs(prevJobs => {
      const newJobs = { ...prevJobs };
      delete newJobs[accountId];
      return newJobs;
    });
  };

  return (
    <JobContext.Provider value={{ jobs, startJob, pauseJob, resumeJob, stopJob, clearJobForAccount }}>
      {children}
    </JobContext.Provider>
  );
};