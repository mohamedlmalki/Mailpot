import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import axios from 'axios';
import { useAccount } from './AccountContext';

// Interface for a single import result
interface ImportResult {
  id: number;
  email: string;
  status: 'pending' | 'success' | 'error';
  details: string;
}

// Interface for the state of a single import job
interface Job {
  id: string; // Corresponds to accountId
  name: string; // Account name for display
  apiKey: string;
  emailList: string[];
  tagId?: number; // Optional Tag ID to assign
  results: ImportResult[];
  currentIndex: number;
  isRunning: boolean;
  isPaused: boolean;
  delay: number; // in seconds
  countdown: number;
  startTime: number | null;
  endTime: number | null;
  pauseTime: number | null; // Track when a pause starts
  totalPausedTime: number; // Accumulate total time spent paused
}

// Interface for the JobContext
interface JobContextType {
  jobs: Record<string, Job>;
  startJob: (accountId: string, name: string, apiKey: string, emails: string, delay: number, tagId?: string) => void;
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

// The provider component
export const JobProvider = ({ children }: { children: ReactNode }) => {
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const intervalRef = useRef<NodeJS.Timeout>();

  // Main processing loop that runs every second
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
              // Time to process the next item
              if (job.currentIndex < job.emailList.length) {
                processQueueItem(job); 
                job.currentIndex += 1;
                job.countdown = job.delay;
              } else {
                // Job finished
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

  // Function to process a single email import
  const processQueueItem = async (job: Job) => {
    const email = job.emailList[job.currentIndex];
    
    // Updated payload for System.io - simple email object
    const contactPayload = {
      email: email
    };
    
    let newResult: ImportResult;
    try {
      // 1. Create Contact
      const createResponse = await axios.post('http://localhost:5006/api/contacts', {
        apiKey: job.apiKey,
        ...contactPayload
      });

      // STORE ORIGINAL RESPONSE (Formatted JSON)
      let details = JSON.stringify(createResponse.data, null, 2);

      // 2. Assign Tag (if tagId is present)
      if (job.tagId) {
        const contactId = createResponse.data.id;
        if (contactId) {
            try {
                const tagRes = await axios.post(`http://localhost:5006/api/contacts/${contactId}/tags`, {
                    apiKey: job.apiKey,
                    tagId: job.tagId
                });
                // Append Tag Success Response
                details += `\n\n[Tag Assigned]:\n${JSON.stringify(tagRes.data, null, 2)}`;
            } catch (tagError: any) {
                // Append Tag Error Response
                const tagErrData = tagError.response?.data || { message: tagError.message };
                details += `\n\n[Tag Failed]:\n${JSON.stringify(tagErrData, null, 2)}`;
            }
        } else {
            details += '\n\n[Tag Failed]: No Contact ID returned in creation response to attach tag.';
        }
      }
      
      newResult = { id: job.currentIndex + 1, email, status: 'success', details };

    } catch (error: any) {
      // STORE ORIGINAL ERROR RESPONSE (Formatted JSON)
      const errorData = error.response?.data || { 
        message: error.message || "An unknown network error occurred",
        status: error.response?.status
      };
      
      newResult = { 
        id: job.currentIndex + 1, 
        email, 
        status: 'error', 
        details: JSON.stringify(errorData, null, 2) // Capture the full object as string
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

  const startJob = (accountId: string, name: string, apiKey: string, emails: string, delay: number, tagId?: string) => {
    const emailList = emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    if (emailList.length === 0) return;

    setJobs(prevJobs => ({
      ...prevJobs,
      [accountId]: {
        id: accountId, name, apiKey, emailList, delay,
        tagId: tagId && tagId !== "no-tag" ? parseInt(tagId) : undefined,
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