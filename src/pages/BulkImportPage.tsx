import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, Play, Pause, Square, Clock, Terminal, Download, CheckCircle, XCircle } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '../components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";

import { useAccount } from '../contexts/AccountContext';
import { useJob } from '../contexts/JobContext';

type FilterStatus = 'all' | 'success' | 'error';

interface MailPoetList {
  id: string;
  name: string;
}

const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const BulkImportPage = () => {
    const { selectedAccount } = useAccount();
    const { jobs, startJob, pauseJob, resumeJob, stopJob } = useJob();

    const [emailListInput, setEmailListInput] = useState('');
    const [delayInput, setDelayInput] = useState(2); // Higher default delay for WP
    const [filter, setFilter] = useState<FilterStatus>('all');
    const [unstartedEmailLists, setUnstartedEmailLists] = useState<Record<string, string>>({});
    
    const [lists, setLists] = useState<MailPoetList[]>([]);
    const [selectedListId, setSelectedListId] = useState<string>('no-list');
    const [isLoadingLists, setIsLoadingLists] = useState(false);

    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedResult, setSelectedResult] = useState<any | null>(null);

    const [, setTicker] = useState(0);

    const currentJob = selectedAccount ? jobs[selectedAccount.id] : null;
    const isRunning = currentJob?.isRunning ?? false;
    
    // Fetch Lists
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

    useEffect(() => {
        if (selectedAccount) {
            const job = jobs[selectedAccount.id];
            if (job) { 
                setEmailListInput(job.emailList.join('\n'));
                setDelayInput(job.delay);
                if (job.listId) setSelectedListId(job.listId);
            } else { 
                setEmailListInput(unstartedEmailLists[selectedAccount.id] || '');
            }
        } else {
            setEmailListInput('');
            setLists([]);
        }
    }, [selectedAccount, jobs]);

    useEffect(() => {
        let timer: NodeJS.Timeout | undefined;
        if (currentJob?.isRunning && !currentJob.isPaused) {
            timer = setInterval(() => setTicker(prev => prev + 1), 1000);
        }
        return () => clearInterval(timer);
    }, [currentJob?.isRunning, currentJob?.isPaused]);
    
    const calculateElapsedTime = () => {
        if (!currentJob?.startTime) return 0;
        const endTime = currentJob.endTime || (currentJob.isPaused ? currentJob.pauseTime : Date.now());
        if (!endTime) return 0;
        const elapsed = (endTime - currentJob.startTime - currentJob.totalPausedTime) / 1000;
        return Math.max(0, elapsed);
    };

    const elapsedTime = currentJob ? calculateElapsedTime() : 0;
    const emailCount = useMemo(() => emailListInput.split(/[\n,;]+/).filter(Boolean).length, [emailListInput]);

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setEmailListInput(newValue);
        if (!isRunning && selectedAccount) {
            setUnstartedEmailLists(prev => ({
                ...prev,
                [selectedAccount.id]: newValue,
            }));
        }
    };
    
    const handleStartImport = () => {
        if (!selectedAccount) return toast.error('Please select an account first.');
        if (!emailListInput.trim()) return toast.error('Please provide at least one email address.');
        
        startJob(selectedAccount.id, selectedAccount.name, emailListInput, delayInput, selectedListId);
        
        setUnstartedEmailLists(prev => {
            const newLists = { ...prev };
            delete newLists[selectedAccount.id];
            return newLists;
        });

        toast.info(`Starting import for ${selectedAccount.name}...`);
    };

    const handlePauseResume = () => {
        if (!currentJob || !selectedAccount) return;
        currentJob.isPaused ? resumeJob(selectedAccount.id) : pauseJob(selectedAccount.id);
    };

    const handleStopJob = () => {
        if (!selectedAccount) return;
        stopJob(selectedAccount.id);
        toast.warning(`Import for ${selectedAccount.name} has been stopped.`);
    };

    const { successCount, errorCount } = useMemo(() => {
        if (!currentJob) return { successCount: 0, errorCount: 0 };
        return {
            successCount: currentJob.results.filter(r => r.status === 'success').length,
            errorCount: currentJob.results.filter(r => r.status === 'error').length,
        };
    }, [currentJob]);
    
    const filteredResults = useMemo(() => {
        if (!currentJob) return [];
        if (filter === 'all') return currentJob.results;
        return currentJob.results.filter(result => result.status === filter);
    }, [currentJob, filter]);
    
    const handleExport = () => {
        const emailsToExport = filteredResults.map(result => result.email).join('\n');
        if (!emailsToExport) {
            toast.error("No emails to export for the current filter.");
            return;
        }
        const blob = new Blob([emailsToExport], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `mailpoet_export_${selectedAccount?.name}_${filter}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${filteredResults.length} emails.`);
    };
    
    const handleStatusClick = (result: any) => {
        setSelectedResult(result);
        setDetailsOpen(true);
    };

    const getStatusBadge = (result: any) => {
        const status = result.status;
        
        if (status === 'success') {
            return (
                <Badge 
                    className="bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer transition-colors"
                    onClick={() => handleStatusClick(result)}
                >
                    Success
                </Badge>
            );
        }
        
        return (
            <Badge 
                variant="destructive" 
                className="cursor-pointer hover:bg-red-600 transition-colors"
                onClick={() => handleStatusClick(result)}
            >
                Error
            </Badge>
        );
    };

    const progress = currentJob?.emailList.length ? (currentJob.currentIndex / currentJob.emailList.length) * 100 : 0;
    
    return (
        <div className="p-6 max-w-4xl mx-auto animate-enter">
            <div className="flex items-center gap-3 mb-6">
                <Upload className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Bulk Subscriber Import</h1>
                    <p className="text-muted-foreground">Manage concurrent import jobs for MailPoet</p>
                </div>
            </div>

            {!selectedAccount && (
                <Alert variant="destructive" className="mb-6">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>No Account Selected</AlertTitle>
                    <AlertDescription>Please select an active account from the dropdown in the sidebar.</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>{selectedAccount ? `Job for: ${selectedAccount.name}` : 'Configuration & Results'}</CardTitle>
                    <CardDescription>Each account has its own independent import job.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="emailList">Email List</Label>
                            <Textarea
                                id="emailList"
                                placeholder="Paste emails here..."
                                className="h-48 mt-2"
                                value={emailListInput}
                                onChange={handleTextareaChange}
                                disabled={isRunning}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Emails detected: <span className="font-bold">{emailCount}</span>
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="list-select">Assign to List (Optional)</Label>
                                <Select 
                                    value={selectedListId} 
                                    onValueChange={setSelectedListId} 
                                    disabled={isRunning || isLoadingLists || !selectedAccount}
                                >
                                    <SelectTrigger id="list-select" className="mt-2">
                                        <SelectValue placeholder={isLoadingLists ? "Loading lists..." : "Select List"} />
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

                            <div>
                                <Label htmlFor="delay">Delay (seconds)</Label>
                                <Input
                                    id="delay"
                                    type="number"
                                    value={delayInput}
                                    onChange={(e) => setDelayInput(Math.max(0, Number(e.target.value)))}
                                    min="0"
                                    className="mt-2"
                                    disabled={isRunning}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Delay between requests.</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                            <Button onClick={handleStartImport} className="w-full" disabled={!selectedAccount || isRunning}>
                                <Play className="h-4 w-4 mr-2" /> Start Import
                            </Button>
                            <Button onClick={handlePauseResume} className="w-full" disabled={!isRunning} variant="secondary">
                                <Clock className="h-4 w-4 mr-2" /> {currentJob?.isPaused ? 'Resume' : 'Pause'}
                            </Button>
                            <Button onClick={handleStopJob} className="w-full" disabled={!isRunning} variant="destructive">
                                <Square className="h-4 w-4 mr-2" /> Stop
                            </Button>
                        </div>
                    </div>

                    <Separator className="my-6" />

                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                            <Label>Import Results</Label>
                            <div className="flex items-center gap-2">
                                <ToggleGroup type="single" value={filter} onValueChange={(value: FilterStatus) => value && setFilter(value)} size="sm">
                                    <ToggleGroupItem value="all">All</ToggleGroupItem>
                                    <ToggleGroupItem value="success">Success</ToggleGroupItem>
                                    <ToggleGroupItem value="error">Fail</ToggleGroupItem>
                                </ToggleGroup>
                                <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
                                    <Download className="h-4 w-4" /> Export
                                </Button>
                            </div>
                        </div>
                        {currentJob && (
                            <div className="my-4 space-y-3">
                                <div className="grid grid-cols-3 gap-4 text-center p-4 bg-muted rounded-lg">
                                    <div>
                                        <div className="text-xs text-muted-foreground">TIME ELAPSED</div>
                                        <div className="text-lg font-bold">{formatTime(elapsedTime)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">SUCCESS</div>
                                        <div className="text-lg font-bold text-green-600 flex items-center justify-center gap-1">
                                            <CheckCircle className="h-5 w-5" /> {successCount}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-muted-foreground">FAIL</div>
                                        <div className="text-lg font-bold text-red-600 flex items-center justify-center gap-1">
                                            <XCircle className="h-5 w-5" /> {errorCount}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium text-muted-foreground">
                                            Progress: {currentJob?.currentIndex ?? 0} / {currentJob?.emailList.length ?? 0}
                                        </span>
                                        {isRunning && !currentJob?.isPaused && (
                                            <span className="font-bold">Next in: {currentJob.countdown}s</span>
                                        )}
                                        {currentJob?.isPaused && <span className="font-bold text-yellow-600">Paused</span>}
                                        {!isRunning && currentJob.currentIndex > 0 && <span className="font-bold text-gray-500">Finished</span>}
                                    </div>
                                    <Progress value={progress} />
                                </div>
                            </div>
                        )}
                        <div className="h-80 overflow-y-auto border rounded-md mt-2">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">#</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredResults.length > 0 ? filteredResults.map((result) => (
                                        <TableRow key={result.id}>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{result.id}</TableCell>
                                            <TableCell className="font-mono text-xs">{result.email}</TableCell>
                                            <TableCell>{getStatusBadge(result)}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                {result.details}
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                {selectedAccount ? 'No job active or results to display.' : 'Please select an account.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedResult?.status === 'success' ? <CheckCircle className="text-green-500 h-5 w-5"/> : <XCircle className="text-red-500 h-5 w-5"/>}
                            {selectedResult?.status === 'success' ? 'Import Success' : 'Import Error'}
                        </DialogTitle>
                        <DialogDescription>
                            API Response details for <strong>{selectedResult?.email}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-muted rounded-md border text-sm font-mono whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto shadow-inner">
                        {selectedResult?.details}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BulkImportPage;