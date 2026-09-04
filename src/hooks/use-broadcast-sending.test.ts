import { describe, expect, it } from 'vitest';
import { collectTemplatePlaceholders } from '@/components/broadcasts/step3-personalize';
import { resolveSendTimeParams } from '@/hooks/use-broadcast-sending';
import type { Contact, MessageTemplate } from '@/types';

function mockTemplate(overrides: Partial<MessageTemplate> = {}): MessageTemplate {
  return {
    id: 'tpl-1',
    user_id: 'user-1',
    name: 'admissions_admissions',
    category: 'Marketing',
    language: 'en_US',
    body_text: 'Hello {{1}}, welcome!',
    created_at: '2026-08-10T00:00:00Z',
    ...overrides,
  };
}

function mockContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'contact-1',
    user_id: 'user-1',
    name: 'Preetham',
    phone: '+916363045415',
    email: 'preetham@example.com',
    company: 'Acme',
    created_at: '2026-08-10T00:00:00Z',
    updated_at: '2026-08-10T00:00:00Z',
    ...overrides,
  };
}

describe('collectTemplatePlaceholders', () => {
  it('collects body, text header, and URL button placeholders', () => {
    const template = mockTemplate({
      header_type: 'text',
      header_content: 'Dear {{1}}',
      body_text: 'Your application {{1}} is received.',
      buttons: [
        { type: 'URL', text: 'View Status', url: 'https://example.com/status/{{1}}' },
      ],
    });

    const items = collectTemplatePlaceholders(template);
    expect(items).toHaveLength(3);

    expect(items[0]).toMatchObject({
      key: 'header_1',
      category: 'header',
      label: 'Header {{1}}',
    });
    expect(items[1]).toMatchObject({
      key: '1',
      category: 'body',
      label: 'Body {{1}}',
    });
    expect(items[2]).toMatchObject({
      key: 'button_0',
      category: 'button',
      label: 'URL Button #1 ("View Status") {{1}}',
    });
  });
});

describe('resolveSendTimeParams', () => {
  it('resolves body, header, and button parameters for a recipient', () => {
    const template = mockTemplate({
      header_type: 'text',
      header_content: 'Notice for {{1}}',
      body_text: 'Hi {{1}}, your id is {{2}}.',
      buttons: [
        { type: 'URL', text: 'Link', url: 'https://example.com/{{1}}' },
      ],
    });

    const contact = mockContact({ name: 'Preetham' });
    const customValues = new Map<string, string>([['custom-1', 'ADM-999']]);

    const variables = {
      header_1: { type: 'field' as const, value: 'name' },
      '1': { type: 'field' as const, value: 'name' },
      '2': { type: 'custom_field' as const, value: 'custom-1' },
      button_0: { type: 'static' as const, value: 'ref-123' },
    };

    const resolved = resolveSendTimeParams(variables, template, contact, customValues);

    expect(resolved.headerText).toBe('Preetham');
    expect(resolved.body).toEqual(['Preetham', 'ADM-999']);
    expect(resolved.buttonParams).toEqual({ 0: 'ref-123' });
  });

  it('resolves image header URL for media headers', () => {
    const template = mockTemplate({
      header_type: 'image',
      body_text: 'Hello {{1}}',
    });

    const contact = mockContact({ name: 'Preetham' });
    const variables = {
      header_media: { type: 'static' as const, value: 'https://example.com/banner.jpg' },
      '1': { type: 'field' as const, value: 'name' },
    };

    const resolved = resolveSendTimeParams(variables, template, contact);

    expect(resolved.headerMediaUrl).toBe('https://example.com/banner.jpg');
    expect(resolved.body).toEqual(['Preetham']);
  });
});
