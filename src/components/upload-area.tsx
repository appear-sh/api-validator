"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { Upload, FileUp, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// Define the expected result structure from the API
type ValidationResult = {
  source: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  path?: string[];
  range?: { start: { line: number, character: number }, end: { line: number, character: number } };
};

interface UploadAreaProps {
  onValidationStart: () => void;
  onValidationComplete: (results: ValidationResult[], specContent: string, error?: string) => void;
  isLoading?: boolean;
}

export function UploadArea({ 
  onValidationStart, 
  onValidationComplete, 
  isLoading: parentIsLoading 
}: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isProcessingResults, setIsProcessingResults] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json") && !file.name.endsWith(".yaml") && !file.name.endsWith(".yml")) {
      toast.error("Invalid file format", {
        description: "Please upload a JSON or YAML file",
      })
      return
    }

    // --- Client-side size check (optional but good UX) ---
    // Use megabytes (1000*1000) to align with Vercel's likely limit definition
    const MAX_FILE_SIZE_BYTES = 4.5 * 1000 * 1000; // 4.5 MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("File Too Large", {
        description: "File exceeds the 4.5 MB limit. Please use a smaller file or split your specification using $refs.",
      });
      return; // Stop before even trying to upload
    }
    // --- End client-side check ---

    console.log("Starting file upload and validation...");
    setFileName(file.name)
    setIsUploading(true)
    setIsProcessingResults(false)
    onValidationStart()

    const formData = new FormData()
    formData.append('file', file)

    let specContent = ''
    try {
      // Read content locally for display, separate from upload
      specContent = await file.text()
    } catch (readError) {
      console.error("Error reading file locally:", readError)
      toast.error("File Read Error", {
        description: "Could not read the file content locally.",
      })
      setIsUploading(false)
      setIsProcessingResults(false)
      onValidationComplete([], '', "Could not read file content.")
      return
    }

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        body: formData,
      })

      // --- Check for 413 status specifically ---
      if (response.status === 413) {
        console.error("Validation failed: Payload Too Large (413)");
        const errorMessage = "File exceeds the 4.5 MB limit. Please use a smaller file or consider splitting your specification using $refs.";
        toast.error("File Too Large", {
          description: errorMessage,
        });
        setIsUploading(false);
        setIsProcessingResults(false);
        onValidationComplete([], specContent, errorMessage); // Pass the specific error message
        return; // Stop further processing
      }
      // --- End 413 check ---

      const data = await response.json()

      if (!response.ok) {
        // Use data.error if available, otherwise use statusText
        throw new Error(data.error || `Validation request failed: ${response.statusText} (Status: ${response.status})`)
      }

      // Mark that we've received results but are still processing
      setIsProcessingResults(true)
      console.log("API validation complete, processing results...");
      
      // Use sonner toast for success
      toast.success("Validation complete!", {
        description: `Checked across validators.`,
      })
      
      // Pass data to parent which will handle the transition
      onValidationComplete(data.results || [], specContent)
      
      // Keep the loader running until parent confirms rendering is complete
      // The parent component will use a delayed state update pattern and
      // the effect in the parent will update the isLoading state, which will
      // eventually trickle down as a prop to children

    } catch (fetchError) {
      console.error("Validation failed:", fetchError)
      const errorMessage = fetchError instanceof Error ? fetchError.message : "An unknown error occurred during validation."
      // Use sonner toast for error
      toast.error("Validation failed", {
        description: errorMessage,
      })
      setIsUploading(false)
      setIsProcessingResults(false)
      onValidationComplete([], specContent, errorMessage)
    }
  }, [onValidationStart, onValidationComplete])

  // Update our local loading states when parent changes
  useEffect(() => {
    // If parent is no longer loading but we still have processing flags active,
    // this means the parent has finished processing the results and we can stop our indicators
    if (parentIsLoading === false && (isUploading || isProcessingResults)) {
      console.log("Parent finished loading, resetting upload states");
      setIsUploading(false);
      setIsProcessingResults(false);
    }
  }, [parentIsLoading, isUploading, isProcessingResults]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length) {
      handleFileUpload(files[0])
    }
  }, [handleFileUpload])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files?.length) {
      handleFileUpload(files[0])
    }
  }, [handleFileUpload])

  // Consider both uploading and processing as active states for UI
  const isActive = isUploading || isProcessingResults;

  return (
    <Card className="mb-8 border-border/40 bg-card/30 backdrop-blur-sm">
      <CardContent className="p-4">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-4 transition-all duration-200",
            isDragging ? "border-primary bg-primary/10" : "border-border/50 hover:border-primary/30 hover:bg-card/50",
            isActive && "cursor-not-allowed opacity-70"
          )}
          onDragOver={isActive ? undefined : handleDragOver}
          onDragLeave={isActive ? undefined : handleDragLeave}
          onDrop={isActive ? undefined : handleDrop}
        >
          <div className="flex items-center justify-center sm:justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "rounded-full p-3 transition-all duration-200",
                  isDragging ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20",
                )}
              >
                {isActive ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : (
                  <Upload className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold">Upload your OpenAPI 3.x spec</h3>
                <p className="text-sm text-muted-foreground">
                  {isUploading ? "Processing..." : isProcessingResults ? "Preparing results..." : "Drag and drop your JSON or YAML file here, or click to browse"}
                </p>
                {fileName && (
                  <div className="flex items-center gap-2 text-sm mt-1">
                    {isActive ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>{isUploading ? `Validating ${fileName}...` : `Processing ${fileName}...`}</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3 text-green-500" />
                        <span>Ready: {fileName}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <Button
              onClick={() => !isActive && document.getElementById("file-upload")?.click()}
              disabled={isActive}
              variant="outline"
              className="gap-2 bg-background/50 hover:bg-background/80 hover:text-primary transition-all whitespace-nowrap"
            >
              {isActive ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4" />
              )}
              {isUploading ? "Uploading..." : isProcessingResults ? "Processing..." : "Browse"}
            </Button>
            <input
              id="file-upload"
              type="file"
              accept=".json,.yaml,.yml"
              className="hidden"
              onChange={handleFileChange}
              disabled={isActive}
            />
          </div>
        </div>
        {/* Add max file size indicator */}
        <p className="text-xs text-muted-foreground text-center mt-2">
          Maximum file size: 4.5 MB
        </p>
      </CardContent>
    </Card>
  )
}
