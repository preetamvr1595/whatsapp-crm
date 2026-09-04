'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Contact, CustomField, MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Eye, ExternalLink, Loader2 } from 'lucide-react';
import { extractVariableIndices } from '@/lib/whatsapp/template-validators';

type VariableType = 'static' | 'field' | 'custom_field';

interface VariableMapping {
  type: VariableType;
  value: string;
}

interface Step3Props {
  template: MessageTemplate;
  variables: Record<string, VariableMapping>;
  onUpdate: (variables: Record<string, VariableMapping>) => void;
  onNext: () => void;
  onBack: () => void;
}

export interface PlaceholderItem {
  key: string;
  label: string;
  typeLabel: string;
  rawPlaceholder: string;
  category: 'header' | 'body' | 'button';
  buttonIndex?: number;
  buttonText?: string;
  buttonUrl?: string;
}

export function collectTemplatePlaceholders(template: MessageTemplate): PlaceholderItem[] {
  const items: PlaceholderItem[] = [];

  // 1. Header (text or media)
  if (template.header_type === 'text' && template.header_content) {
    const headerVars = extractVariableIndices(template.header_content);
    if (headerVars.length > 0) {
      items.push({
        key: 'header_1',
        label: 'Header {{1}}',
        typeLabel: 'Header',
        rawPlaceholder: '{{1}}',
        category: 'header',
      });
    }
  } else if (['image', 'video', 'document'].includes(template.header_type ?? '')) {
    items.push({
      key: 'header_media',
      label: `Header ${template.header_type!.toUpperCase()} URL`,
      typeLabel: 'Header Media',
      rawPlaceholder: 'media_url',
      category: 'header',
    });
  }

  // 2. Body variables
  const bodyVars = extractVariableIndices(template.body_text);
  for (const v of bodyVars) {
    items.push({
      key: String(v),
      label: `Body {{${v}}}`,
      typeLabel: 'Body',
      rawPlaceholder: `{{${v}}}`,
      category: 'body',
    });
  }

  // 3. Button variables (URL buttons with {{1}})
  (template.buttons ?? []).forEach((btn, idx) => {
    if (btn.type === 'URL') {
      const urlVars = extractVariableIndices(btn.url);
      if (urlVars.length > 0) {
        items.push({
          key: `button_${idx}`,
          label: `URL Button #${idx + 1} ("${btn.text}") {{1}}`,
          typeLabel: `Button #${idx + 1}`,
          rawPlaceholder: '{{1}}',
          category: 'button',
          buttonIndex: idx,
          buttonText: btn.text,
          buttonUrl: btn.url,
        });
      }
    }
  });

  return items;
}

const contactFields = [
  { value: 'name', label: 'Contact Name' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'company', label: 'Company' },
];

const SAMPLE_CONTACT: Contact = {
  id: 'sample',
  user_id: '',
  name: 'John Doe',
  phone: '+1234567890',
  email: 'john@example.com',
  company: 'Acme Corp',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function Step3Personalize({
  template,
  variables,
  onUpdate,
  onNext,
  onBack,
}: Step3Props) {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [firstContact, setFirstContact] = useState<Contact | null>(null);
  const [firstContactCustomValues, setFirstContactCustomValues] = useState<
    Map<string, string>
  >(new Map());
  const [loadingPreview, setLoadingPreview] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [fieldsRes, contactRes] = await Promise.all([
        supabase.from('custom_fields').select('*').order('field_name'),
        supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      setCustomFields(fieldsRes.data ?? []);
      setLoadingFields(false);

      const contact = contactRes.data ?? null;
      setFirstContact(contact);

      if (contact) {
        const { data: customVals } = await supabase
          .from('contact_custom_values')
          .select('custom_field_id, value')
          .eq('contact_id', contact.id);
        if (!cancelled) {
          const map = new Map<string, string>();
          for (const row of customVals ?? []) {
            map.set(row.custom_field_id, row.value ?? '');
          }
          setFirstContactCustomValues(map);
        }
      }
      setLoadingPreview(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const placeholders = useMemo(() => {
    return collectTemplatePlaceholders(template);
  }, [template]);

  const unmappedKeys = useMemo(() => {
    const missing: string[] = [];
    for (const item of placeholders) {
      const mapping = variables[item.key];
      if (!mapping || !mapping.value?.trim()) {
        missing.push(item.label);
      }
    }
    return missing;
  }, [placeholders, variables]);

  function updateVariable(key: string, patch: Partial<VariableMapping>) {
    const current = variables[key] ?? { type: 'static' as VariableType, value: '' };
    onUpdate({
      ...variables,
      [key]: { ...current, ...patch },
    });
  }

  const previewHeader = useMemo(() => {
    if (template.header_type !== 'text' || !template.header_content) return null;
    const contact = firstContact ?? SAMPLE_CONTACT;
    const customValues = firstContact ? firstContactCustomValues : new Map<string, string>();
    const mapping = variables['header_1'];
    let val = '{{1}}';
    if (mapping && mapping.value?.trim()) {
      if (mapping.type === 'static') val = mapping.value;
      else if (mapping.type === 'field') {
        const fieldMap: Record<string, string | undefined> = {
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          company: contact.company,
        };
        val = fieldMap[mapping.value] ?? '{{1}}';
      } else if (mapping.type === 'custom_field') {
        val = customValues.get(mapping.value) || '{{1}}';
      }
    }
    return template.header_content.replaceAll('{{1}}', val);
  }, [template, variables, firstContact, firstContactCustomValues]);

  const previewBody = useMemo(() => {
    const contact = firstContact ?? SAMPLE_CONTACT;
    const customValues = firstContact ? firstContactCustomValues : new Map<string, string>();

    let text = template.body_text;
    const bodyItems = placeholders.filter((p) => p.category === 'body');
    for (const item of bodyItems) {
      const mapping = variables[item.key];
      let replacement = item.rawPlaceholder;
      if (mapping && mapping.value?.trim()) {
        if (mapping.type === 'static') replacement = mapping.value;
        else if (mapping.type === 'field') {
          const fieldMap: Record<string, string | undefined> = {
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            company: contact.company,
          };
          replacement = fieldMap[mapping.value] ?? item.rawPlaceholder;
        } else if (mapping.type === 'custom_field') {
          replacement = customValues.get(mapping.value) || item.rawPlaceholder;
        }
      }
      text = text.replaceAll(item.rawPlaceholder, replacement);
    }
    return text;
  }, [template.body_text, variables, placeholders, firstContact, firstContactCustomValues]);

  const previewButtons = useMemo(() => {
    if (!template.buttons || template.buttons.length === 0) return [];
    const contact = firstContact ?? SAMPLE_CONTACT;
    const customValues = firstContact ? firstContactCustomValues : new Map<string, string>();

    return template.buttons.map((btn, idx) => {
      if (btn.type === 'URL') {
        const key = `button_${idx}`;
        const mapping = variables[key];
        let val = '{{1}}';
        if (mapping && mapping.value?.trim()) {
          if (mapping.type === 'static') val = mapping.value;
          else if (mapping.type === 'field') {
            const fieldMap: Record<string, string | undefined> = {
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              company: contact.company,
            };
            val = fieldMap[mapping.value] ?? '{{1}}';
          } else if (mapping.type === 'custom_field') {
            val = customValues.get(mapping.value) || '{{1}}';
          }
        }
        const resolvedUrl = btn.url.replaceAll('{{1}}', val);
        return { text: btn.text, url: resolvedUrl, type: 'URL' as const };
      }
      return { text: btn.text, type: btn.type };
    });
  }, [template.buttons, variables, firstContact, firstContactCustomValues]);

  const previewLabel = firstContact
    ? firstContact.name || firstContact.phone
    : 'sample data';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Personalize Message</h2>
        <p className="mt-1 text-sm text-slate-400">
          Map template variables (body, header, and URL buttons) to contact fields, custom fields, or static values.
        </p>
      </div>

      {placeholders.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
          <p className="text-sm text-slate-400">
            This template has no variables to personalize.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {placeholders.map((item) => {
            const mapping = variables[item.key] ?? { type: 'static', value: '' };

            return (
              <div
                key={item.key}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-mono font-medium text-primary">
                      {item.label}
                    </span>
                  </div>
                  {item.buttonUrl && (
                    <span className="text-[11px] font-mono text-slate-400 truncate max-w-[280px]">
                      URL Template: {item.buttonUrl}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">
                      Mapping Type
                    </label>
                    <Select
                      value={mapping.type}
                      onValueChange={(val) =>
                        updateVariable(item.key, {
                          type: val as VariableType,
                          value: '',
                        })
                      }
                    >
                      <SelectTrigger className="w-full border-slate-700 bg-slate-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-800">
                        <SelectItem value="static">Static Value</SelectItem>
                        <SelectItem value="field">Contact Field</SelectItem>
                        <SelectItem value="custom_field">
                          Custom Field
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">
                      {mapping.type === 'static' ? 'Value' : 'Field'}
                    </label>
                    {mapping.type === 'static' ? (
                      <Input
                        value={mapping.value}
                        onChange={(e) =>
                          updateVariable(item.key, { value: e.target.value })
                        }
                        placeholder={
                          item.category === 'button'
                            ? 'Enter URL suffix / parameter…'
                            : 'Enter value…'
                        }
                        className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                      />
                    ) : mapping.type === 'field' ? (
                      <Select
                        value={mapping.value || ''}
                        onValueChange={(val) =>
                          updateVariable(item.key, { value: val || '' })
                        }
                      >
                        <SelectTrigger className="w-full border-slate-700 bg-slate-800 text-white">
                          <SelectValue placeholder="Select field..." />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-800">
                          {contactFields.map((field) => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={mapping.value || ''}
                        onValueChange={(val) =>
                          updateVariable(item.key, { value: val || '' })
                        }
                      >
                        <SelectTrigger className="w-full border-slate-700 bg-slate-800 text-white">
                          <SelectValue
                            placeholder={
                              loadingFields
                                ? 'Loading…'
                                : customFields.length === 0
                                  ? 'No custom fields'
                                  : 'Select custom field…'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-800">
                          {customFields.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.field_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Preview */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-white">Live Preview</p>
          <span className="text-xs text-slate-500">({previewLabel})</span>
          {loadingPreview && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          )}
        </div>
        <div className="rounded-lg bg-[#0e1a12] p-3 space-y-2">
          <div className="ml-auto max-w-[85%] rounded-lg bg-primary/30 px-3 py-2 shadow-sm space-y-1.5">
            {previewHeader && (
              <p className="text-sm font-bold text-primary">{previewHeader}</p>
            )}
            <p className="whitespace-pre-wrap text-sm text-primary">
              {previewBody}
            </p>
            {template.footer_text && (
              <p className="text-xs italic text-primary/70">
                {template.footer_text}
              </p>
            )}
          </div>
          {previewButtons.length > 0 && (
            <div className="ml-auto max-w-[85%] space-y-1">
              {previewButtons.map((btn, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                >
                  {btn.text}
                  {btn.type === 'URL' && (
                    <span className="flex items-center gap-1 text-[10px] opacity-80">
                      <ExternalLink className="h-3 w-3" />
                      ({btn.url})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {unmappedKeys.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Map every variable placeholder before continuing — missing:{' '}
          <span className="font-mono font-semibold">
            {unmappedKeys.join(', ')}
          </span>
          .
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-800 pt-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-slate-700 text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={unmappedKeys.length > 0}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

