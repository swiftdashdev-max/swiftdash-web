'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  AlertCircle,
  RefreshCw,
  User,
  Car,
  Calendar
} from 'lucide-react';
import { 
  getDriverVerificationSubmissions, 
  updateVerificationStatus,
  getVerificationStats,
  DriverVerificationSubmission 
} from '@/lib/supabase/driver-verification';
import { format } from 'date-fns';

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-blue-100 text-blue-800', icon: Eye },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
  needs_revision: { label: 'Needs Revision', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
};

interface DriverVerificationWithUser extends DriverVerificationSubmission {
  user_profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
  };
  vehicle_types: {
    id: string;
    name: string;
    description?: string;
  };
  reviewed_by_profile?: {
    first_name: string;
    last_name: string;
  };
}

export function DriverVerificationManagement() {
  const [submissions, setSubmissions] = useState<DriverVerificationWithUser[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<DriverVerificationWithUser | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load submissions
      const submissionsResult = await getDriverVerificationSubmissions({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50
      });

      if (submissionsResult.success) {
        setSubmissions(submissionsResult.data || []);
      }

      // Load stats
      const statsResult = await getVerificationStats();
      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error('Error loading verification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (
    submissionId: string, 
    newStatus: DriverVerificationSubmission['status']
  ) => {
    setIsUpdating(true);
    try {
      const result = await updateVerificationStatus(
        submissionId,
        newStatus,
        'admin-user-id', // Replace with actual admin user ID
        reviewNotes
      );

      if (result.success) {
        await loadData(); // Reload data
        setSelectedSubmission(null);
        setReviewNotes('');
        alert('Status updated successfully!');
      } else {
        alert(`Failed to update status: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('An error occurred while updating the status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending + stats.under_review}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.this_week}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Driver Verification Submissions</CardTitle>
          <CardDescription>
            Review and manage driver document verification requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div>
                <Label htmlFor="status-filter">Filter by Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="needs_revision">Needs Revision</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Submissions Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Vehicle Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {submission.user_profiles.first_name} {submission.user_profiles.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {submission.user_profiles.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span>{submission.vehicle_types.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(submission.status)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(submission.submitted_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSubmission(submission)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Review
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Driver Verification Review</DialogTitle>
                            <DialogDescription>
                              Review documents for {submission.user_profiles.first_name} {submission.user_profiles.last_name}
                            </DialogDescription>
                          </DialogHeader>
                          
                          {selectedSubmission && (
                            <div className="space-y-6">
                              {/* Driver Info */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Driver Name</Label>
                                  <p className="text-sm">{selectedSubmission.user_profiles.first_name} {selectedSubmission.user_profiles.last_name}</p>
                                </div>
                                <div>
                                  <Label>Email</Label>
                                  <p className="text-sm">{selectedSubmission.user_profiles.email}</p>
                                </div>
                                <div>
                                  <Label>Vehicle Type</Label>
                                  <p className="text-sm">{selectedSubmission.vehicle_types.name}</p>
                                  {selectedSubmission.vehicle_types.description && (
                                    <p className="text-xs text-muted-foreground">{selectedSubmission.vehicle_types.description}</p>
                                  )}
                                </div>
                                <div>
                                  <Label>Current Status</Label>
                                  <div className="mt-1">{getStatusBadge(selectedSubmission.status)}</div>
                                </div>
                              </div>

                              {/* Documents */}
                              <div>
                                <Label>Uploaded Documents</Label>
                                <div className="mt-2 space-y-2">
                                  {Object.entries(selectedSubmission.documents).map(([docType, urls]) => (
                                    <div key={docType} className="border rounded-lg p-3">
                                      <h4 className="font-medium capitalize mb-2">{docType.replace('_', ' ')}</h4>
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        {urls.map((url, index) => (
                                          <a
                                            key={index}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block border rounded-lg p-2 hover:bg-muted transition-colors"
                                          >
                                            <div className="aspect-square bg-muted rounded flex items-center justify-center mb-1">
                                              <FileText className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-xs text-center truncate">
                                              {selectedSubmission.file_names[docType]?.[index] || `Document ${index + 1}`}
                                            </p>
                                          </a>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Review Actions */}
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="review-notes">Review Notes</Label>
                                  <Textarea
                                    id="review-notes"
                                    placeholder="Add review notes (optional)"
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                  />
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => handleStatusUpdate(selectedSubmission.id!, 'approved')}
                                    disabled={isUpdating}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve
                                  </Button>
                                  <Button
                                    onClick={() => handleStatusUpdate(selectedSubmission.id!, 'rejected')}
                                    disabled={isUpdating}
                                    variant="destructive"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                  <Button
                                    onClick={() => handleStatusUpdate(selectedSubmission.id!, 'needs_revision')}
                                    disabled={isUpdating}
                                    variant="outline"
                                  >
                                    <AlertCircle className="h-4 w-4 mr-2" />
                                    Request Revision
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {submissions.length === 0 && (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No submissions found</h3>
              <p className="text-sm text-muted-foreground">
                No driver verification submissions match your current filter.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}