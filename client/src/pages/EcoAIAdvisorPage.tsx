import * as React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

interface AdvisorSource {
  topic: string;
  title: string;
  content: string;
}

interface AdvisorResponse {
  answer: string;
  sources: AdvisorSource[];
}

type AnswerBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

function sanitizeAnswerText(text: string): string {
  return text
    .replace(/^\s*hello,\s*i am ecoai advisor\.?\s*/i, '')
    .replace(/^\s*(?:based on the provided information|according to the provided information|based on the information provided)\s*,?\s*/i, '')
    .replace(/^\s*(?:here is(?: what you should do| how you should handle and recycle)?|here is how you should handle and dispose of)\s*:?\s*/i, '')
    .replace(/\(\s*(?:source topics?|relevant sources?)\s*[:\-].*?\)/gi, '')
    .replace(/\b(?:source topics?|relevant sources?)\s*[:\-].*$/gi, '')
    .replace(/^\s*\*?\s*sources?\s*[:\-].*$/gim, '')
    .replace(/\bnote:\s*for.*?(government sources|official sources).*?(?:\.|$)/gi, '')
    .replace(/\*\*/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\(\s*$/g, '')
    .replace(/^\s*\)/g, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|\*|_|`/g, '')
    .replace(/^\s+|\s+$/g, '')
    .trim();
}

function formatAnswer(answer: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: cleanMarkdown(paragraph.join(' ')) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ type: 'list', items: list.map(cleanMarkdown) });
      list = [];
    }
  };

  for (const rawLine of answer.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    const boldHeadingMatch = line.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/);
    const listMatch = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', text: cleanMarkdown(headingMatch[1]) });
    } else if (boldHeadingMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'heading', text: cleanMarkdown(boldHeadingMatch[1]) });
      if (boldHeadingMatch[2]) {
        blocks.push({ type: 'paragraph', text: cleanMarkdown(boldHeadingMatch[2]) });
      }
    } else if (listMatch) {
      flushParagraph();
      list.push(listMatch[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function EcoAIAdvisorPage() {
  const { toast } = useToast();
  const [question, setQuestion] = React.useState('');
  const [answer, setAnswer] = React.useState<AdvisorResponse | null>(null);
  const [isAsking, setIsAsking] = React.useState(false);
  const [selectedSource, setSelectedSource] = React.useState<AdvisorSource | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      toast({
        title: 'Question required',
        description: 'Please enter a question about e-waste recycling.',
        variant: 'destructive',
      });
      return;
    }

    setIsAsking(true);
    setAnswer(null);
    try {
      const response = await fetch('/api/ecoai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmedQuestion }),
      });
      const responseData = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseData?.message || 'EcoAI Advisor is unavailable.');
      }
      setAnswer(responseData as AdvisorResponse);
    } catch (error) {
      toast({
        title: 'Advisor unavailable',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-bold">EcoAI Advisor</h2>
        <p className="text-muted-foreground">Ask questions about safe e-waste handling and recycling.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ask EcoAI</CardTitle>
          <CardDescription>Get concise guidance grounded in the local e-waste knowledge base.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask something like: How should I recycle a damaged laptop?"
              maxLength={1000}
              rows={4}
              disabled={isAsking}
              aria-label="EcoAI Advisor question"
            />
            <Button type="submit" className="w-full" disabled={isAsking}>
              <Sparkles className="mr-2 h-4 w-4" />
              {isAsking ? 'Thinking...' : 'Ask EcoAI'}
            </Button>
          </form>

          {answer && (
            <div className="mt-6 space-y-5 rounded-md border border-primary/20 bg-primary/5 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-primary">AI Answer</h3>
                </div>
                <div className="mt-3 space-y-3 text-primary/90">
                  {formatAnswer(sanitizeAnswerText(answer.answer)).map((block, index) => {
                    if (block.type === 'heading') {
                      return <h4 key={`${block.text}-${index}`} className="font-semibold text-primary">{block.text}</h4>;
                    }
                    if (block.type === 'list') {
                      return (
                        <ul key={`list-${index}`} className="list-disc space-y-1 pl-5">
                          {block.items.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      );
                    }
                    return <p key={`paragraph-${index}`}>{block.text}</p>;
                  })}
                </div>
              </div>
              <div className="border-t border-primary/10 pt-4">
                <p className="text-sm text-muted-foreground">Relevant Sources</p>
                {answer.sources.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {answer.sources.map((source, index) => (
                      <button
                        key={`${source.title}-${index}`}
                        type="button"
                        className="rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                        onClick={() => setSelectedSource(source)}
                        aria-label={`View source: ${source.title}`}
                      >
                        <Badge variant="outline" className="cursor-pointer hover:bg-secondary">
                          {source.title}
                        </Badge>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No relevant knowledge topics were found.</p>
                )}
              </div>
            </div>
          )}
          <Dialog open={selectedSource !== null} onOpenChange={(open) => !open && setSelectedSource(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{selectedSource?.title}</DialogTitle>
                <DialogDescription>{selectedSource?.topic}</DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-6 text-muted-foreground">{selectedSource?.content}</p>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
