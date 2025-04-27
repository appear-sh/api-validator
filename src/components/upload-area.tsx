"use client"

import type React from "react"
import { useState, useCallback } from "react"
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
}

export function UploadArea({ onValidationStart, onValidationComplete }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json") && !file.name.endsWith(".yaml") && !file.name.endsWith(".yml")) {
      toast.error("Invalid file format", {
        description: "Please upload a JSON or YAML file",
      })
      return
    }

    setFileName(file.name)
    setIsUploading(true)
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
      onValidationComplete([], '', "Could not read file content.")
      return
    }

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Validation request failed: ${response.statusText}`)
      }

      // Use sonner toast for success
      toast.success("Validation complete!", {
        description: `Checked across validators.`,
      })
      onValidationComplete(data.results || [], specContent)

    } catch (fetchError) {
      console.error("Validation failed:", fetchError)
      const errorMessage = fetchError instanceof Error ? fetchError.message : "An unknown error occurred during validation."
      // Use sonner toast for error
      toast.error("Validation failed", {
        description: errorMessage,
      })
      onValidationComplete([], specContent, errorMessage)
    } finally {
      setIsUploading(false)
    }
  }, [onValidationStart, onValidationComplete])

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

  return (
    <Card className="mb-8 border-border/40 bg-card/30 backdrop-blur-sm">
      <CardContent className="p-6">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-10 text-center transition-all duration-200",
            isDragging ? "border-primary bg-primary/10" : "border-border/50 hover:border-border/80 hover:bg-card/50",
            isUploading && "cursor-not-allowed opacity-70"
          )}
          onDragOver={isUploading ? undefined : handleDragOver}
          onDragLeave={isUploading ? undefined : handleDragLeave}
          onDrop={isUploading ? undefined : handleDrop}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div
              className={cn(
                "rounded-full p-4 transition-all duration-200",
                isDragging ? "bg-primary/20" : "bg-primary/10",
              )}
            >
              {isUploading ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <Upload className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Upload your API spec</h3>
              <p className="text-sm text-muted-foreground">
                {isUploading ? "Processing..." : "Drag and drop your JSON or YAML file here, or click to browse"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => !isUploading && document.getElementById("file-upload")?.click()}
                disabled={isUploading}
                variant="outline"
                className="gap-2 bg-background/50 hover:bg-background/80 transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {isUploading ? "Uploading..." : "Browse Files"}
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".json,.yaml,.yml"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </div>
            {fileName && (
              <div className="flex items-center gap-2 text-sm mt-2">
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Validating {fileName}...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Ready: {fileName}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
