import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { UploadCloud, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export function AIDetectionPage() {
  const { toast } = useToast();
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [detectionResult, setDetectionResult] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setDetectionResult(null);
      setProgress(0);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  }

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

    setIsDetecting(true);
    setDetectionResult('Analyzing image...');
    setProgress(30);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey || apiKey === 'YOUR_GOOGLE_AI_GEMINI_API_KEY') {
        throw new Error("VITE_GEMINI_API_KEY is not set in your client/.env file.");
      }
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
      const imagePart = await fileToGenerativePart(file);
      const prompt = "Analyze this image and identify the electronic waste item. Describe what it is. If it's not e-waste, say so.";

      const payload = {
        contents: [{
          parts: [{ text: prompt }, imagePart],
        }],
      };
      
      setProgress(60);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

     if (!response.ok) {
  const errorData = await response.json();
  console.error("Gemini API Error:", errorData);
  throw new Error(
    errorData?.error?.message || `Gemini API Error: ${response.status}`
  );
}
      
      setProgress(80);
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        setDetectionResult(text);
        toast({
          title: 'Detection Complete!',
        });
      } else {
        throw new Error('Could not parse the AI response.');
      }
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
      setIsDetecting(false);
    }
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
              <div className="mt-6 rounded-md border border-primary/20 bg-primary/10 p-4">
                <p className="font-semibold text-primary">AI Analysis:</p>
                <p className="mt-2 text-primary/90">{detectionResult}</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
