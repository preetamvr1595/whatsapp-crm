'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Loader2, CheckCircle, XCircle, ArrowRight, Tag, Phone } from 'lucide-react';
import type { Tag as TagType } from '@/types';

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type StandardField = 'phone' | 'name' | 'email' | 'company' | 'ignore';

function sanitizePhone(phoneStr: string, defaultCountryCode: string): string {
  let cleaned = phoneStr.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (!cleaned.startsWith('+')) {
    const code = defaultCountryCode.startsWith('+') ? defaultCountryCode : `+${defaultCountryCode}`;
    cleaned = `${code}${cleaned.replace(/^0+/, '')}`;
  }
  return cleaned;
}

function parseCSVHeadersAndRows(text: string): { headers: string[]; rawRows: Record<string, string>[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rawRows: [] };

  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));

  const rawRows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''));

    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = values[idx] || '';
    });

    rawRows.push(rowObj);
  }

  return { headers, rawRows };
}

export function ImportModal({ open, onOpenChange, onImported }: ImportModalProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  
  // Column Mappings: key = CSV Header, value = StandardField or "custom:<attribute_name>"
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [defaultCountryCode, setDefaultCountryCode] = useState('+91');
  
  const [availableTags, setAvailableTags] = useState<TagType[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>('none');
  const [newTagName, setNewTagName] = useState('');

  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  useEffect(() => {
    if (open) {
      loadTags();
    }
  }, [open]);

  async function loadTags() {
    try {
      const { data } = await supabase.from('tags').select('*').order('name');
      if (data) setAvailableTags(data);
    } catch (err) {
      console.error('Failed to fetch tags:', err);
    }
  }

  function reset() {
    setStep(1);
    setFile(null);
    setHeaders([]);
    setRawRows([]);
    setMappings({});
    setSelectedTagId('none');
    setNewTagName('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);

    selected.text().then((text) => {
      const { headers: parsedHeaders, rawRows: parsedRows } = parseCSVHeadersAndRows(text);

      if (parsedHeaders.length === 0 || parsedRows.length === 0) {
        toast.error('No valid rows found in CSV.');
        return;
      }

      setHeaders(parsedHeaders);
      setRawRows(parsedRows);

      // Auto-suggest mappings based on header names
      const initialMappings: Record<string, string> = {};
      parsedHeaders.forEach((h) => {
        const lower = h.toLowerCase();
        if (lower.includes('phone') || lower.includes('mobile') || lower.includes('number') || lower.includes('contact')) {
          initialMappings[h] = 'phone';
        } else if (lower === 'name' || lower.includes('full name') || lower.includes('first name')) {
          initialMappings[h] = 'name';
        } else if (lower.includes('email')) {
          initialMappings[h] = 'email';
        } else if (lower.includes('company') || lower.includes('org') || lower.includes('college')) {
          initialMappings[h] = 'company';
        } else {
          initialMappings[h] = `custom:${h}`;
        }
      });

      setMappings(initialMappings);
      setStep(2);
    });
  }

  async function handleImport() {
    const phoneHeader = Object.keys(mappings).find((h) => mappings[h] === 'phone');
    if (!phoneHeader) {
      toast.error('Please map at least one CSV column to the Phone Number field.');
      return;
    }

    setImporting(true);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error('Not authenticated');

      let targetTagId = selectedTagId !== 'none' ? selectedTagId : null;

      // Create new tag if requested
      if (newTagName.trim()) {
        const { data: createdTag, error: tagErr } = await supabase
          .from('tags')
          .insert({ user_id: user.id, name: newTagName.trim(), color: '#3b82f6' })
          .select()
          .single();

        if (!tagErr && createdTag) {
          targetTagId = createdTag.id;
        }
      }

      let importedCount = 0;
      let failedCount = 0;

      const contactsToInsert = rawRows.map((row) => {
        const phoneRaw = row[phoneHeader] || '';
        const phoneFormatted = sanitizePhone(phoneRaw, defaultCountryCode);

        let name: string | null = null;
        let email: string | null = null;
        let company: string | null = null;
        const customAttributes: Record<string, string> = {};

        Object.entries(mappings).forEach(([csvHeader, mappedTarget]) => {
          const val = row[csvHeader];
          if (!val) return;

          if (mappedTarget === 'name') name = val;
          else if (mappedTarget === 'email') email = val;
          else if (mappedTarget === 'company') company = val;
          else if (mappedTarget.startsWith('custom:')) {
            const customKey = mappedTarget.replace('custom:', '');
            customAttributes[customKey] = val;
          }
        });

        return {
          user_id: user.id,
          phone: phoneFormatted,
          name,
          email,
          company,
          custom_attributes: Object.keys(customAttributes).length > 0 ? customAttributes : {},
        };
      }).filter((c) => Boolean(c.phone));

      if (contactsToInsert.length === 0) {
        toast.error('No valid phone numbers found after formatting.');
        setImporting(false);
        return;
      }

      // Batch insert in chunks of 50
      const chunkSize = 50;
      for (let i = 0; i < contactsToInsert.length; i += chunkSize) {
        const chunk = contactsToInsert.slice(i, i + chunkSize);

        const { data: insertedData, error: batchErr } = await supabase
          .from('contacts')
          .insert(chunk)
          .select('id');

        if (batchErr) {
          // Fallback to individual inserts to handle conflicts
          for (const item of chunk) {
            const { data: singleData, error: singleErr } = await supabase
              .from('contacts')
              .insert(item)
              .select('id')
              .single();

            if (singleErr) {
              failedCount++;
            } else if (singleData) {
              importedCount++;
              if (targetTagId) {
                await supabase.from('contact_tags').insert({
                  contact_id: singleData.id,
                  tag_id: targetTagId,
                });
              }
            }
          }
        } else if (insertedData) {
          importedCount += insertedData.length;
          if (targetTagId) {
            const tagAssignments = insertedData.map((c) => ({
              contact_id: c.id,
              tag_id: targetTagId,
            }));
            await supabase.from('contact_tags').insert(tagAssignments);
          }
        }
      }

      setResult({ imported: importedCount, failed: failedCount });
      if (importedCount > 0) {
        toast.success(`Successfully imported ${importedCount} contacts!`);
        onImported();
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} contacts failed to import.`);
      }
      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload className="size-5 text-primary" /> Bulk CSV Contact Importer
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Import bulk contact records from any CSV file. Map custom fields like Course, Admission Year, or City automatically.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4 py-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/40 p-8 cursor-pointer hover:border-primary/50 hover:bg-slate-800/80 transition-all"
            >
              <Upload className="size-10 text-primary" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Click to upload CSV file</p>
                <p className="text-xs text-slate-400 mt-1">Supports any header structure (e.g. Phone, Name, Course, City)</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* Step 2: Mapping & Tags */}
        {step === 2 && (
          <div className="space-y-6 py-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {rawRows.length} Contacts Found
              </span>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-slate-400">Default Country Code:</Label>
                <Input
                  value={defaultCountryCode}
                  onChange={(e) => setDefaultCountryCode(e.target.value)}
                  className="w-20 h-7 text-xs bg-slate-800 border-slate-700 text-white font-mono"
                />
              </div>
            </div>

            {/* Column Mapping Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="size-3.5 text-primary" /> Map CSV Headers to Contact Attributes
              </h4>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {headers.map((h) => (
                  <div key={h} className="flex items-center justify-between gap-3 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                    <span className="text-xs font-mono text-slate-300 truncate max-w-[160px]">{h}</span>
                    <ArrowRight className="size-3.5 text-slate-500 shrink-0" />
                    <Select
                      value={mappings[h] || 'ignore'}
                      onValueChange={(val) => {
                        if (val) setMappings((prev) => ({ ...prev, [h]: val }));
                      }}
                    >
                      <SelectTrigger className="w-48 h-8 text-xs bg-slate-900 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-200 text-xs">
                        <SelectItem value="phone" className="text-primary font-bold">Phone Number (Required)</SelectItem>
                        <SelectItem value="name">Full Name</SelectItem>
                        <SelectItem value="email">Email Address</SelectItem>
                        <SelectItem value="company">Company / College</SelectItem>
                        <SelectItem value={`custom:${h}`}>Custom Field ({h})</SelectItem>
                        <SelectItem value="ignore" className="text-slate-500">Ignore Column</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Tag Assignment Section */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="size-3.5 text-primary" /> Tag Imported Contacts
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">Select Existing Tag</Label>
                  <Select value={selectedTagId} onValueChange={(val) => setSelectedTagId(val || 'none')}>
                    <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="No Tag" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-200 text-xs">
                      <SelectItem value="none">No Tag</SelectItem>
                      {availableTags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">Or Create New Tag</Label>
                  <Input
                    placeholder="e.g. Batch-2026"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="h-8 text-xs bg-slate-800 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Result Summary */}
        {step === 3 && result && (
          <div className="py-6 space-y-4">
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center space-y-3">
              <CheckCircle className="size-12 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Import Execution Completed</h3>
              <div className="flex items-center justify-center gap-6 text-sm pt-2">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle className="size-4" /> {result.imported} Contacts Added
                </span>
                {result.failed > 0 && (
                  <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                    <XCircle className="size-4" /> {result.failed} Failed
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-slate-800 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 h-8 text-xs"
          >
            {step === 3 ? 'Close' : 'Cancel'}
          </Button>

          {step === 2 && (
            <Button
              type="button"
              disabled={importing}
              onClick={handleImport}
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs"
            >
              {importing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Importing Contacts...
                </>
              ) : (
                `Import ${rawRows.length} Contacts`
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
