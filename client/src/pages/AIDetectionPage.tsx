import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge, badgeVariants } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { DetectionResult } from '@/types';

const privacySteps = [
  'Backup important data',
  'Sign out of accounts',
  'Remove SIM card',
  'Remove SD card',
  'Transfer important files',
  'Factory reset the device',
  'Remove the device from major accounts/services',
];

function needsPrivacyChecklist(result: DetectionResult) {
  return /mobile|phone|laptop|computer|tablet|hard drive|storage|ssd|usb/i.test(`${result.deviceType} ${result.category}`);
}

const knowledgeTopicDetails: Record<string, { summary: string; points: string[] }> = {
  'E-Waste Safety Guidelines': {
    summary: 'Basic precautions for handling unwanted or damaged electronic equipment.',
    points: [
      'Do not open, crush, burn, or place suspected batteries in household waste.',
      'Keep damaged electronics dry and away from heat, children, and flammable materials.',
      'Avoid touching exposed wires, sharp components, leaking fluids, or swollen batteries.',
      'Use an authorized collection point or registered recycler for items that may be hazardous.',
    ],
  },
  'Recycling Procedures': {
    summary: 'Practical steps for preparing electronics for reuse, collection, or recycling.',
    points: [
      'Back up and remove personal data before handing over a device when possible.',
      'Keep the device and its components together and avoid dismantling it at home.',
      'Prefer an authorized e-waste collection centre, producer take-back programme, or registered recycler.',
      'Working equipment may be suitable for repair, reuse, or refurbishment before recycling.',
    ],
  },
  'Device Information': {
    summary: 'Why common electronics need separate handling at the end of their useful life.',
    points: [
      'Laptops and mobile devices can contain rechargeable batteries and recoverable materials.',
      'Displays, printers, and appliances contain electronic components that should not be mixed with household waste.',
      'Different devices may require different collection or dismantling processes.',
    ],
  },
  'Indian E-Waste Regulations': {
    summary: 'General educational context about electronic-waste handling in India.',
    points: [
      'India has e-waste rules and an extended producer responsibility framework for covered electronic and electrical equipment.',
      'Use registered or authorized collection and recycling channels where available.',
      'Regulatory requirements can change and may depend on the item and location.',
      'Verify current requirements with official CPCB guidance or other relevant government sources.',
    ],
  },
};

export function AIDetectionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [detectionResult, setDetectionResult] = React.useState<DetectionResult | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [selectedKnowledgeTopic, setSelectedKnowledgeTopic] = React.useState<string | null>(null);
  const [completedPrivacySteps, setCompletedPrivacySteps] = React.useState<boolean[]>(privacySteps.map(() => false));
  const processingFileRef = React.useRef<File | null>(null);
  const completedFileRef = React.useRef<File | null>(null);

  React.useEffect(() => {
    setCompletedPrivacySteps(privacySteps.map(() => false));
  }, [detectionResult]);

  const compressImage = async (selectedFile: File): Promise<File> => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(selectedFile);
    try {
      image.src = objectUrl;
      await image.decode();

      const maxDimension = 1600;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);

      let compressedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', 0.82);
      });
      let compressedType = 'image/webp';
      let extension = 'webp';
      if (!compressedBlob) {
        compressedBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.82);
        });
        compressedType = 'image/jpeg';
        extension = 'jpg';
      }
      if (!compressedBlob) {
        throw new Error('The selected image could not be prepared for analysis.');
      }

      return new File([compressedBlob], `${selectedFile.name.replace(/\.[^.]+$/, '')}.${extension}`, {
        type: compressedType,
        lastModified: selectedFile.lastModified,
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const analyzeFile = async (selectedFile: File) => {
    if (processingFileRef.current === selectedFile || completedFileRef.current === selectedFile) {
      return;
    }

    processingFileRef.current = selectedFile;
    setIsDetecting(true);
    setDetectionResult(null);
    setProgress(10);

    try {
      const compressedFile = await compressImage(selectedFile);
      setProgress(35);
      const formData = new FormData();
      formData.append('image', compressedFile);

      let response: Response | null = null;
      let responseData: DetectionResult | { message?: string } | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await fetch('/api/ai-detection', {
            method: 'POST',
            body: formData,
          });
          responseData = await response.json().catch(() => null);
          if (response.ok || response.status < 500) {
            break;
          }
        } catch (error) {
          if (attempt === 1) {
            throw error;
          }
        }
      }

      if (!response?.ok) {
        throw new Error((responseData as { message?: string } | null)?.message || 'There was a problem detecting the e-waste.');
      }

      setProgress(85);
      setDetectionResult(responseData as DetectionResult);
      completedFileRef.current = selectedFile;
      toast({ title: 'Detection Complete!' });
      setProgress(100);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'There was a problem detecting the e-waste.';
      setDetectionResult(null);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      processingFileRef.current = null;
      setIsDetecting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      completedFileRef.current = null;
      setDetectionResult(null);
      setProgress(0);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
      void analyzeFile(selectedFile);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select an image file to detect.',
        variant: 'destructive',
      });
      return;
    }
    await analyzeFile(file);
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold mb-2">AI E-Waste Detection</h2>
        <p className="text-muted-foreground">
          Upload an image of an electronic item to identify it using Gemini.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Upload Image</CardTitle>
          <CardDescription>Our AI will analyze the image and identify the type of e-waste.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="ewaste-image" className="sr-only">E-Waste Image</Label>
              <div className="flex w-full items-center justify-center">
                <label htmlFor="ewaste-image" className="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card hover:bg-secondary/50">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="mb-3 h-10 w-10 text-muted-foreground" />
                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, or GIF</p>
                    </div>
                    <Input id="ewaste-image" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              </div> 
            </div>

            {preview && (
              <div className="mt-4">
                <p className="text-sm font-medium text-center mb-2">Image Preview:</p>
                <img src={preview} alt="E-waste preview" className="mx-auto max-h-60 rounded-md shadow-md" />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isDetecting || !file}>
              {isDetecting ? 'Analyzing...' : <> <Sparkles className="mr-2 h-4 w-4" /> Detect E-Waste </>}
            </Button>

            {isDetecting && (
                <div className="space-y-2">
                    <Progress value={progress} className="w-full" />
                    <p className="text-sm text-center text-muted-foreground">AI is thinking...</p>
                </div>
            )}

            {detectionResult && !isDetecting && (
              <Card className="mt-6 border-primary/20 bg-primary/5">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle>AI E-Waste Analysis</CardTitle>
                    <Badge variant={detectionResult.isEWaste ? 'default' : 'secondary'}>
                      {detectionResult.isEWaste ? 'E-waste detected' : 'Not identified as e-waste'}
                    </Badge>
                  </div>
                  <CardDescription>AI confidence is an estimate based on the uploaded image.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><p className="text-sm text-muted-foreground">Device Type</p><p className="font-medium">{detectionResult.deviceType}</p></div>
                    <div><p className="text-sm text-muted-foreground">Category</p><p className="font-medium">{detectionResult.category}</p></div>
                    <div><p className="text-sm text-muted-foreground">Condition</p><p className="font-medium">{detectionResult.condition}</p></div>
                    <div><p className="text-sm text-muted-foreground">Possible Hazard</p><p className="font-medium">{detectionResult.possibleHazard}</p></div>
                    <div><p className="text-sm text-muted-foreground">E-Waste Status</p><p className="font-medium">{detectionResult.isEWaste ? 'Yes' : 'No'}</p></div>
                    <div><p className="text-sm text-muted-foreground">Confidence (estimate)</p><p className="font-medium">{detectionResult.confidence}%</p></div>
                  </div>
                  <div className="border-t border-primary/10 pt-4">
                    <p className="text-sm text-muted-foreground">Short Description</p>
                    <p className="mt-1 text-primary/90">{detectionResult.description}</p>
                  </div>
                  {detectionResult.isEWaste && detectionResult.estimatedValue && (
                    <div className="rounded-md border border-primary/20 bg-background p-4">
                      <p className="text-sm text-muted-foreground">Estimated Recovery / Resale Value</p>
                      <p className="mt-1 text-xl font-semibold text-primary">{detectionResult.estimatedValue}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Estimated value - not a market quote.</p>
                    </div>
                  )}
                  {detectionResult.environmentalImpact && (
                    <div className="border-t border-primary/10 pt-4">
                      <h3 className="font-semibold text-primary">Environmental Impact</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{detectionResult.environmentalImpact.impactSummary}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-md border bg-background p-3"><p className="text-sm text-muted-foreground">Estimated E-Waste Diverted</p><p className="mt-1 text-lg font-semibold">{detectionResult.environmentalImpact.estimatedWeightKg} kg</p></div>
                        <div className="rounded-md border bg-background p-3"><p className="text-sm text-muted-foreground">Potential Material Recovery</p><p className="mt-1 text-sm font-medium">{detectionResult.environmentalImpact.materialRecoveryPotential.join(' • ')}</p></div>
                      </div>
                      <div className="mt-3 space-y-2"><div className="flex justify-between text-sm"><span>Estimated recovery potential</span><span>{detectionResult.environmentalImpact.recoveryPercent}%</span></div><Progress value={detectionResult.environmentalImpact.recoveryPercent} /><p className="text-xs text-muted-foreground">{detectionResult.environmentalImpact.recyclingBenefit}</p></div>
                    </div>
                  )}
                  {detectionResult.isEWaste && needsPrivacyChecklist(detectionResult) && (
                    <div className="border-t border-primary/10 pt-4">
                      <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-primary">Before You Recycle</h3><p className="text-sm text-muted-foreground">Data Privacy</p></div><span className="text-sm font-medium">{completedPrivacySteps.filter(Boolean).length} / {privacySteps.length} completed</span></div>
                      <Progress className="mt-3" value={(completedPrivacySteps.filter(Boolean).length / privacySteps.length) * 100} />
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {privacySteps.map((step, index) => <label key={step} className="flex items-center gap-2 text-sm"><Checkbox checked={completedPrivacySteps[index]} onCheckedChange={(checked) => setCompletedPrivacySteps((current) => current.map((value, stepIndex) => stepIndex === index ? checked === true : value))} /><span>{step}</span></label>)}
                      </div>
                      {/hard drive|storage|ssd|usb/i.test(`${detectionResult.deviceType} ${detectionResult.category}`) && <p className="mt-3 text-xs text-muted-foreground">Storage devices may need secure data wiping before handover. Follow the manufacturer or recycler&apos;s guidance.</p>}
                    </div>
                  )}
                  {detectionResult.recyclingAdvice && (
                  <div className="border-t border-primary/10 pt-4">
                    <h3 className="font-semibold text-primary">Recycling Advice</h3>
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Recommended Action</p>
                        <p className="mt-1 text-primary/90">{detectionResult.recyclingAdvice.recommendedAction}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Safety Advice</p>
                        <p className="mt-1 text-primary/90">{detectionResult.recyclingAdvice.safetyAdvice}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Recycling Guidance</p>
                        <p className="mt-1 text-primary/90">{detectionResult.recyclingAdvice.recyclingGuidance}</p>
                      </div>
                      {detectionResult.isEWaste && (
                      <div>
                        <p className="text-sm text-muted-foreground">Relevant Knowledge Topics</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {detectionResult.recyclingAdvice.relevantSources.map((source) => (
                            <button
                              key={source}
                              type="button"
                              className={cn(badgeVariants({ variant: 'outline' }), 'cursor-pointer hover:bg-secondary')}
                              onClick={() => setSelectedKnowledgeTopic(source)}
                            >
                              {source}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Regulatory information is educational and should be verified with current official sources.
                        </p>
                      </div>
                      )}
                    </div>
                  </div>
                  )}
                  {detectionResult.smartRecommendation && (
                  <div className="border-t border-primary/10 pt-4">
                    <h3 className="font-semibold text-primary">Smart Recycling Recommendation</h3>
                    <div className="mt-3 space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Recommended Action</p>
                        <p className="mt-1 text-lg font-semibold text-primary">{detectionResult.smartRecommendation.action}</p>
                        <p className="mt-2 text-primary/90">{detectionResult.smartRecommendation.why}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">Why this recommendation?</p>
                        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                          <div>
                            <dt className="text-muted-foreground">Device</dt>
                            <dd className="font-medium text-primary/90">{detectionResult.deviceType}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Condition</dt>
                            <dd className="font-medium text-primary/90">{detectionResult.condition}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Hazard</dt>
                            <dd className="font-medium text-primary/90">{detectionResult.possibleHazard}</dd>
                          </div>
                        </dl>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">What should the user do?</p>
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-primary/90">{detectionResult.smartRecommendation.nextSteps.map((step) => <li key={step}>{step}</li>)}</ol>
                      </div>
                      <div className="grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-muted-foreground">Safety precautions</p><p className="mt-1 text-primary/90">{detectionResult.smartRecommendation.safetyPrecautions}</p></div><div><p className="text-muted-foreground">Next available option</p><p className="mt-1 text-primary/90">{detectionResult.smartRecommendation.nextAvailableOption}</p></div></div>
                      <Button type="button" onClick={() => navigate(`/find-recycler?category=${encodeURIComponent(detectionResult.category)}&deviceType=${encodeURIComponent(detectionResult.deviceType)}&condition=${encodeURIComponent(detectionResult.condition)}&hazard=${encodeURIComponent(detectionResult.possibleHazard)}`)}>
                        Find a suitable recycler
                      </Button>
                    </div>
                  </div>
                  )}
                </CardContent>
              </Card>
            )}
            <Dialog
              open={selectedKnowledgeTopic !== null}
              onOpenChange={(open) => {
                if (!open) setSelectedKnowledgeTopic(null);
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{selectedKnowledgeTopic}</DialogTitle>
                  <DialogDescription>
                    {selectedKnowledgeTopic ? knowledgeTopicDetails[selectedKnowledgeTopic]?.summary : ''}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm text-muted-foreground">
                  {(selectedKnowledgeTopic
                    ? knowledgeTopicDetails[selectedKnowledgeTopic]?.points
                    : []
                  )?.map((point) => (
                    <p key={point}>• {point}</p>
                  ))}
                  {selectedKnowledgeTopic === 'Indian E-Waste Regulations' && (
                    <p className="border-t pt-3 text-xs">
                      This information is educational and should be verified using current official sources.
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
