import React from 'react';
// PageLayout import removed
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Upload, BarChart2 } from 'lucide-react';

const DashboardPage = () => {
  return (
    // PageLayout wrapper removed
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your Omnisend Manager.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Card components remain */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+250</div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Button asChild><Link to="/import/single"><UserPlus className="mr-2 h-4 w-4" /> Add Single Subscriber</Link></Button>
                <Button asChild variant="outline"><Link to="/import/bulk"><Upload className="mr-2 h-4 w-4" /> Bulk Import Subscribers</Link></Button>
                 <Button asChild variant="secondary"><Link to="/subscribers"><Users className="mr-2 h-4 w-4" /> View All Subscribers</Link></Button>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;