"use client"

import { useState } from "react"
import { Search, Copy, Download, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import type { ValidationIssue } from "@/lib/types"
import { useValidationResults } from "@/hooks/use-validation-results"
import { ScoreDisplay } from "@/components/score-display"

export function ValidatorComparison() {
  const { results, isLoading } = useValidationResults()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null)
  const { toast } = useToast()

  const handleCopyResults = () => {
    if (!results) return

    const jsonString = JSON.stringify(results, null, 2)
    navigator.clipboard.writeText(jsonString)

    toast({
      title: "Copied to clipboard",
      description: "Validation results have been copied to your clipboard.",
    })
  }

  const handleDownloadResults = () => {
    if (!results) return

    const jsonString = JSON.stringify(results, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = url
    a.download = "validation-results.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const filterIssues = (issues: ValidationIssue[]) => {
    return issues.filter((issue) => {
      const matchesSearch =
        searchQuery === "" ||
        issue.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.path?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesSeverity = selectedSeverity === null || issue.severity === selectedSeverity

      return matchesSearch && matchesSeverity
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center items-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            <p className="text-muted-foreground">Loading validation results...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!results || results.validators.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center items-center min-h-[400px]">
          <div className="text-center max-w-md">
            <h3 className="text-lg font-medium mb-2">No validation results yet</h3>
            <p className="text-muted-foreground mb-4">
              Upload an API spec to see how different validators interpret and validate it.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Validation Results</h2>
          <p className="text-muted-foreground">
            Comparing {results.validators.length} validators for {results.fileName}
          </p>
        </div>

        <ScoreDisplay score={results.overallScore} />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search issues by message or path..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedSeverity === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSeverity(null)}
          >
            All
          </Button>
          <Button
            variant={selectedSeverity === "error" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSeverity("error")}
            className="text-red-500"
          >
            Errors
          </Button>
          <Button
            variant={selectedSeverity === "warning" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSeverity("warning")}
            className="text-yellow-500"
          >
            Warnings
          </Button>
          <Button
            variant={selectedSeverity === "info" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSeverity("info")}
            className="text-blue-500"
          >
            Info
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleCopyResults}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleDownloadResults}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue={results.validators[0]?.id}>
        <TabsList className="mb-4 flex-wrap">
          {results.validators.map((validator) => (
            <TabsTrigger key={validator.id} value={validator.id} className="flex gap-2 items-center">
              {validator.name}
              <Badge variant={validator.score > 80 ? "default" : "outline"}>{validator.score}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {results.validators.map((validator) => (
          <TabsContent key={validator.id} value={validator.id}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">{validator.name} Results</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-red-500">
                      {validator.issues.filter((i) => i.severity === "error").length} Errors
                    </Badge>
                    <Badge variant="outline" className="text-yellow-500">
                      {validator.issues.filter((i) => i.severity === "warning").length} Warnings
                    </Badge>
                    <Badge variant="outline" className="text-blue-500">
                      {validator.issues.filter((i) => i.severity === "info").length} Info
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] pr-4">
                  {filterIssues(validator.issues).length > 0 ? (
                    <div className="space-y-3">
                      {filterIssues(validator.issues).map((issue, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-md border border-muted hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={`mt-1 rounded-full h-2 w-2 flex-shrink-0 ${
                                issue.severity === "error"
                                  ? "bg-red-500"
                                  : issue.severity === "warning"
                                    ? "bg-yellow-500"
                                    : "bg-blue-500"
                              }`}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{issue.message}</p>
                              {issue.path && (
                                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                                  <code className="px-1 py-0.5 bg-muted rounded text-xs">{issue.path}</code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => {
                                      // This would highlight the corresponding location in the spec
                                      toast({
                                        title: "Location highlighted",
                                        description: `Highlighted path: ${issue.path}`,
                                      })
                                    }}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              {issue.suggestion && (
                                <p className="mt-1 text-sm text-muted-foreground">Suggestion: {issue.suggestion}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-[300px] text-muted-foreground">
                      No issues found matching your filters
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
