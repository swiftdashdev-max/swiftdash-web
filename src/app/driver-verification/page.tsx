'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useDriverAuth } from '@/hooks/use-driver-auth';
import { uploadDriverDocument, STORAGE_BUCKETS } from '@/lib/supabase/storage';
import { saveDriverVerificationSubmission } from '@/lib/supabase/driver-verification';
import { getVehicleTypes } from '@/lib/supabase/driver-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  Car, 
  Shield, 
  Camera, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft,
  Eye,
  X,
  User,
  LogOut
} from 'lucide-react';
import { Reveal, SlideIn } from '@/components/animations';
import { ThemeToggle } from '@/components/theme-toggle';

// Vehicle types will be loaded from database

const documentRequirements = [
  {
    id: 'license',
    title: "Driver's License",
    description: 'Valid Professional Driver\'s License (front and back)',
    icon: <Shield className="h-5 w-5" />,
    required: true,
    multiple: true, // front and back
    bucket: STORAGE_BUCKETS.DRIVER_LICENSE,
  },
  {
    id: 'clearance',
    title: 'NBI/Police Clearance',
    description: 'NBI, Police, or Barangay Clearance with "NO DEROGATORY RECORD"',
    icon: <FileText className="h-5 w-5" />,
    required: true,
    multiple: false,
    bucket: STORAGE_BUCKETS.LTFRB_DOCUMENTS, // Using LTFRB bucket for clearances
  },
  {
    id: 'vehicle_or',
    title: 'Vehicle OR',
    description: 'Official Receipt of vehicle registration',
    icon: <FileText className="h-5 w-5" />,
    required: true,
    multiple: false,
    bucket: STORAGE_BUCKETS.VEHICLE_OR_CR,
  },
  {
    id: 'vehicle_cr',
    title: 'Vehicle CR',
    description: 'Certificate of Registration',
    icon: <FileText className="h-5 w-5" />,
    required: true,
    multiple: false,
    bucket: STORAGE_BUCKETS.VEHICLE_OR_CR,
  },
  {
    id: 'authorization',
    title: 'Authorization (if not owner)',
    description: 'Letter of Authorization with owner\'s ID or Notarized Deed of Sale',
    icon: <FileText className="h-5 w-5" />,
    required: false,
    multiple: true,
    bucket: STORAGE_BUCKETS.LTFRB_DOCUMENTS,
  },
  {
    id: 'vehicle_photos',
    title: 'Vehicle Photos',
    description: 'Clear photos of vehicle (front, back, both sides with license plate)',
    icon: <Camera className="h-5 w-5" />,
    required: true,
    multiple: true,
    bucket: STORAGE_BUCKETS.VEHICLE_PHOTOS,
  },
];

export default function DriverVerificationPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedVehicleType, setSelectedVehicleType] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  const [previewFiles, setPreviewFiles] = useState<Record<string, string[]>>({});
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [loadingVehicleTypes, setLoadingVehicleTypes] = useState(true);
  const router = useRouter();
  const { user, isLoading, logout, updateUser, requireAuth } = useDriverAuth();

  const totalSteps = 3;
  const progress = (currentStep / totalSteps) * 100;

  // Custom logout handler with confirmation
  const handleLogout = () => {
    const hasProgress = currentStep > 1 || Object.keys(uploadedFiles).length > 0;
    
    if (hasProgress) {
      const confirmed = window.confirm(
        'Your verification progress has been saved and can be resumed by logging in again. Are you sure you want to logout?'
      );
      if (!confirmed) return;
    }
    
    logout();
  };

  // Check authentication on component mount
  useEffect(() => {
    requireAuth();
  }, [requireAuth]);

  // Load vehicle types from database
  useEffect(() => {
    const loadVehicleTypes = async () => {
      console.log('Loading vehicle types for user:', user?.id);
      setLoadingVehicleTypes(true);
      try {
        const data = await getVehicleTypes();
        console.log('Received vehicle types:', data);
        setVehicleTypes(data || []);
        
        if (!data || data.length === 0) {
          console.warn('No vehicle types returned from database');
        }
      } catch (error) {
        console.error('Error loading vehicle types:', error);
        // Fallback to empty array if database is not accessible
        setVehicleTypes([]);
        // Show user-friendly error message
        alert('Unable to load vehicle types. Please check your internet connection and try again.');
      } finally {
        setLoadingVehicleTypes(false);
      }
    };

    // Only load if user is authenticated
    if (user) {
      loadVehicleTypes();
    }
  }, [user]);

  // Load existing verification progress if user has any
  useEffect(() => {
    if (user?.submission_data) {
      const submissionData = user.submission_data;
      
      // Restore vehicle type selection
      if (submissionData.vehicle_type_id) {
        setSelectedVehicleType(submissionData.vehicle_type_id);
      }
      
      // Restore uploaded documents URLs
      if (submissionData.documents) {
        setUploadedUrls(submissionData.documents);
      }
      
      // If user has already submitted, skip to final step
      if (submissionData.status !== 'pending') {
        setCurrentStep(3);
      } else if (submissionData.vehicle_type_id) {
        // If vehicle type is selected, start from step 2
        setCurrentStep(2);
      }
    } else if (user?.vehicle_type_id) {
      setSelectedVehicleType(user.vehicle_type_id);
    }
  }, [user]);

  // Add confirmation dialog for page unload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only show warning if user is in the middle of verification process
      if (currentStep > 1 || Object.keys(uploadedFiles).length > 0) {
        event.preventDefault();
        return (event.returnValue = 'Your verification progress will be saved, but you will need to log in again to continue. Are you sure you want to leave?');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentStep, uploadedFiles]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user (shouldn't happen due to redirect, but safety check)
  if (!user) {
    return null;
  }

  const handleFileUpload = async (documentId: string, files: FileList | null) => {
    if (!files || !user) return;

    const fileArray = Array.from(files);
    const document = documentRequirements.find(doc => doc.id === documentId);
    if (!document) return;

    setUploadingFiles(prev => ({ ...prev, [documentId]: true }));

    try {
      const newFiles = { ...uploadedFiles };
      const newPreviews = { ...previewFiles };
      const newUrls = { ...uploadedUrls };

      if (!newFiles[documentId]) newFiles[documentId] = [];
      if (!newPreviews[documentId]) newPreviews[documentId] = [];
      if (!newUrls[documentId]) newUrls[documentId] = [];

      for (const file of fileArray) {
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
          alert('Please upload only JPG, PNG, or PDF files.');
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert('File size must be less than 10MB.');
          continue;
        }

        // Upload to Supabase Storage
        const uploadResult = await uploadDriverDocument(
          file,
          document.bucket,
          user.id,
          documentId
        );

        if (uploadResult.success && uploadResult.data) {
          newFiles[documentId].push(file);
          newUrls[documentId].push(uploadResult.data.publicUrl);
          
          // Create preview URL for images
          if (file.type.startsWith('image/')) {
            newPreviews[documentId].push(URL.createObjectURL(file));
          } else {
            newPreviews[documentId].push(''); // PDF placeholder
          }
        } else {
          alert(`Failed to upload ${file.name}: ${uploadResult.error}`);
        }
      }

      setUploadedFiles(newFiles);
      setPreviewFiles(newPreviews);
      setUploadedUrls(newUrls);
    } catch (error) {
      console.error('Upload error:', error);
      alert('An error occurred while uploading files.');
    } finally {
      setUploadingFiles(prev => ({ ...prev, [documentId]: false }));
    }
  };

  const removeFile = (documentId: string, index: number) => {
    const newFiles = { ...uploadedFiles };
    const newPreviews = { ...previewFiles };
    const newUrls = { ...uploadedUrls };

    if (newPreviews[documentId][index]) {
      URL.revokeObjectURL(newPreviews[documentId][index]);
    }

    newFiles[documentId].splice(index, 1);
    newPreviews[documentId].splice(index, 1);
    newUrls[documentId].splice(index, 1);

    setUploadedFiles(newFiles);
    setPreviewFiles(newPreviews);
    setUploadedUrls(newUrls);
  };

  const getUploadedCount = (documentId: string) => {
    return uploadedFiles[documentId]?.length || 0;
  };

  const isDocumentComplete = (doc: any) => {
    const uploaded = getUploadedCount(doc.id);
    if (doc.required && uploaded === 0) return false;
    if (doc.id === 'license' && uploaded < 2) return false; // Need front and back
    if (doc.id === 'vehicle_photos' && uploaded < 4) return false; // Need 4 photos
    return true;
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) return selectedVehicleType !== '';
    if (currentStep === 2) {
      const requiredDocs = documentRequirements.filter(doc => doc.required);
      return requiredDocs.every(doc => isDocumentComplete(doc));
    }
    return true;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Here you would typically upload files to your storage and save to database
    if (!user?.id) {
      alert('User session invalid. Please log in again.');
      return;
    }

    // Get the selected vehicle type name
    const selectedVehicleTypeName = vehicleTypes.find(vt => vt.id === selectedVehicleType)?.name || '';

    // Prepare submission data for database
    const submissionData = {
      user_id: user.id,
      vehicle_type_id: selectedVehicleType,
      vehicle_type: selectedVehicleTypeName, // Add this field in case it's required
      documents: uploadedUrls,
      file_names: Object.keys(uploadedFiles).reduce((acc, key) => {
        acc[key] = uploadedFiles[key].map(file => file.name);
        return acc;
      }, {} as Record<string, string[]>),
      status: 'under_review' as const,
      submitted_at: new Date().toISOString()
    };

    console.log('Submitting verification documents:', submissionData);

    // Save submission to database
    const saveResult = await saveDriverVerificationSubmission(submissionData);
    
    if (!saveResult.success) {
      alert(`Failed to save submission: ${saveResult.error}`);
      setIsSubmitting(false);
      return;
    }

    // Update user's vehicle type and status
    if (user) {
      updateUser({
        vehicle_type: selectedVehicleType,
        verification_status: 'under_review'
      });
    }
    
    setIsSubmitting(false);
    alert('Documents submitted successfully! You will receive a confirmation email within 24-48 hours.');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/assets/images/swiftdash_logo.png"
              alt="SwiftDash Logo"
              width={32}
              height={32}
            />
            <span className="text-xl font-bold text-foreground">SwiftDash</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {/* User Info */}
            <div className="hidden md:flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">
                {user.first_name} {user.last_name}
              </span>
              <span className="text-muted-foreground">({user.email})</span>
            </div>
            
            <ThemeToggle />
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Security Notice */}
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-800">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Notice:</strong> For your protection, your login session will expire when you close this browser tab. 
            However, your verification progress is automatically saved to our secure servers and can be resumed by logging in again.
          </AlertDescription>
        </Alert>

        {/* Progress Restoration Notice */}
        {user?.submission_data && (
          <Alert className="mb-6 border-blue-200 bg-blue-50 text-blue-800">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Welcome back!</strong> Your verification progress has been restored. You can continue from where you left off.
            </AlertDescription>
          </Alert>
        )}

        {/* Verification Status Banner */}
        {user.verification_status === 'verified' && (
          <Alert className="mb-8 border-green-200 bg-green-50 text-green-800">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Verification Complete!</strong> Your documents have been approved. You can now start accepting delivery requests.
            </AlertDescription>
          </Alert>
        )}
        
        {user.verification_status === 'rejected' && (
          <Alert variant="destructive" className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Verification Rejected:</strong> Some of your documents need to be resubmitted. Please check your email for details and upload the required documents again.
            </AlertDescription>
          </Alert>
        )}

        {user.verification_status === 'under_review' && (
          <Alert className="mb-8 border-blue-200 bg-blue-50 text-blue-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Under Review:</strong> Your documents are currently being reviewed by our team. You'll receive an email notification within 24-48 hours.
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Header */}
        <div className="mb-8">
          <Reveal>
            <div className="text-center mb-6">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Driver Verification
              </h1>
              <p className="text-muted-foreground">
                {user.verification_status === 'verified' 
                  ? 'Your verification is complete!' 
                  : user.verification_status === 'rejected'
                  ? 'Please resubmit your documents'
                  : 'Complete your verification to start earning with SwiftDash'
                }
              </p>
            </div>
          </Reveal>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="flex justify-center space-x-4">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step < currentStep
                    ? 'bg-primary text-primary-foreground'
                    : step === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Vehicle Type Selection */}
        {currentStep === 1 && (
          <SlideIn>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Select Your Vehicle Type
                </CardTitle>
                <CardDescription>
                  Choose the type of vehicle you'll be using for deliveries
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingVehicleTypes ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-3 text-muted-foreground">Loading vehicle types...</span>
                  </div>
                ) : vehicleTypes.length === 0 ? (
                  <div className="text-center py-8">
                    <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No vehicle types available</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {vehicleTypes.map((vehicle) => (
                      <div
                        key={vehicle.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          selectedVehicleType === vehicle.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedVehicleType(vehicle.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{vehicle.name}</h3>
                            {vehicle.description && (
                              <p className="text-sm text-muted-foreground">{vehicle.description}</p>
                            )}
                            {vehicle.capacity && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Capacity: {vehicle.capacity}
                              </p>
                            )}
                            {vehicle.base_rate && (
                              <p className="text-xs text-muted-foreground">
                                Base Rate: ₱{vehicle.base_rate}
                                {vehicle.per_km_rate && ` + ₱${vehicle.per_km_rate}/km`}
                              </p>
                            )}
                          </div>
                          <div className={`w-4 h-4 rounded-full border-2 ${
                            selectedVehicleType === vehicle.id
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          }`} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </SlideIn>
        )}

        {/* Step 2: Document Upload */}
        {currentStep === 2 && (
          <SlideIn>
            <div className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please ensure all documents are clear, well-lit, and in accepted formats (JPG, PNG, PDF). 
                  Maximum file size: 10MB per file.
                </AlertDescription>
              </Alert>

              {documentRequirements.map((doc) => (
                <Card key={doc.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {doc.icon}
                      {doc.title}
                      {doc.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                      {!doc.required && <Badge variant="secondary" className="text-xs">Optional</Badge>}
                      {isDocumentComplete(doc) && (
                        <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                      )}
                    </CardTitle>
                    <CardDescription>{doc.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        uploadingFiles[doc.id] 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted-foreground/25 hover:border-primary/50'
                      }`}>
                        {uploadingFiles[doc.id] ? (
                          <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-primary font-medium">Uploading...</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <Label htmlFor={`upload-${doc.id}`} className="cursor-pointer">
                              <span className="text-primary hover:text-primary/80">
                                Click to upload
                              </span>
                              <span className="text-muted-foreground"> or drag and drop</span>
                              <Input
                                id={`upload-${doc.id}`}
                                type="file"
                                multiple={doc.multiple}
                                accept="image/jpeg,image/png,image/jpg,application/pdf"
                                className="hidden"
                                onChange={(e) => handleFileUpload(doc.id, e.target.files)}
                                disabled={uploadingFiles[doc.id]}
                              />
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {doc.multiple ? 'Multiple files allowed' : 'Single file only'} • JPG, PNG, PDF up to 10MB
                            </p>
                          </>
                        )}
                      </div>

                      {/* File Previews */}
                      {uploadedFiles[doc.id] && uploadedFiles[doc.id].length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {uploadedFiles[doc.id].map((file, index) => (
                            <div key={index} className="relative group">
                              <div className="aspect-square border rounded-lg overflow-hidden bg-muted">
                                {previewFiles[doc.id][index] ? (
                                  <img
                                    src={previewFiles[doc.id][index]}
                                    alt={`${doc.title} ${index + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <FileText className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeFile(doc.id, index)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {file.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Special instructions */}
                      {doc.id === 'license' && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Please upload both the front and back of your driver's license.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {doc.id === 'vehicle_photos' && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            Please upload 4 clear photos: front, back, left side, and right side of your vehicle. 
                            Make sure the license plate is visible.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </SlideIn>
        )}

        {/* Step 3: Review and Submit */}
        {currentStep === 3 && (
          <SlideIn>
            <Card>
              <CardHeader>
                <CardTitle>Review Your Submission</CardTitle>
                <CardDescription>
                  Please review all your information before submitting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Vehicle Type Summary */}
                <div>
                  <h3 className="font-medium text-foreground mb-2">Selected Vehicle Type</h3>
                  <Badge variant="outline" className="text-sm">
                    {vehicleTypes.find(v => v.id === selectedVehicleType)?.name || 'Not selected'}
                  </Badge>
                </div>

                {/* Documents Summary */}
                <div>
                  <h3 className="font-medium text-foreground mb-4">Uploaded Documents</h3>
                  <div className="space-y-3">
                    {documentRequirements.map((doc) => {
                      const uploadCount = getUploadedCount(doc.id);
                      return (
                        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {doc.icon}
                            <div>
                              <p className="font-medium text-sm">{doc.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {uploadCount} file{uploadCount !== 1 ? 's' : ''} uploaded
                              </p>
                            </div>
                          </div>
                          {uploadCount > 0 ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    By submitting these documents, you confirm that all information provided is accurate and authentic. 
                    Our team will review your application within 24-48 hours and notify you via email.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </SlideIn>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
          >
            Previous
          </Button>
          
          {currentStep < totalSteps ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceedToNextStep()}
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canProceedToNextStep() || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}