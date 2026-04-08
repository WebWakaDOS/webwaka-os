/**
 * @webwaka/contact
 * Multi-channel contact management: SMS / WhatsApp / Telegram / Email
 *
 * Status: STUB — M7a implementation pending
 * Spec: docs/contact/multi-channel-model.md
 */

export type OTPPreference = 'sms' | 'whatsapp' | 'telegram';
export type NotificationPreference = 'sms' | 'whatsapp' | 'telegram' | 'email';

export interface ContactChannels {
  id: string;
  entity_id: string;
  tenant_id: string;

  primary_phone: string;
  primary_phone_verified: boolean;
  primary_phone_verified_at: number | null;

  whatsapp_phone: string | null;
  whatsapp_verified: boolean;
  whatsapp_verified_at: number | null;
  whatsapp_same_as_primary: boolean;

  telegram_handle: string | null;
  telegram_chat_id: string | null;
  telegram_verified: boolean;
  telegram_verified_at: number | null;

  email: string | null;
  email_verified: boolean;
  email_verified_at: number | null;

  notification_preference: NotificationPreference;
  otp_preference: OTPPreference;

  created_at: number;
  updated_at: number;
}

export interface VerifyChannelRequest {
  channel: 'sms' | 'whatsapp' | 'telegram' | 'email';
  identifier: string; // phone (E.164), telegram @handle, or email
  purpose?: 'verification' | 'login' | 'transaction' | 'kyc_uplift' | 'password_reset';
}

export interface ConfirmChannelRequest extends VerifyChannelRequest {
  code: string;
}

export interface ContactService {
  getChannels(entityId: string): Promise<ContactChannels | null>;
  upsertChannels(entityId: string, data: Partial<ContactChannels>): Promise<ContactChannels>;
  requestOTP(req: VerifyChannelRequest): Promise<{ delivered: boolean; channel: string }>;
  confirmOTP(req: ConfirmChannelRequest): Promise<{ verified: boolean; channel: string }>;
  removeChannel(entityId: string, channel: 'whatsapp' | 'telegram' | 'email'): Promise<void>;
}

// Placeholder: full implementation in M7a
export class ContactServiceStub implements ContactService {
  async getChannels(_entityId: string): Promise<ContactChannels | null> {
    throw new Error('ContactService not implemented — M7a pending');
  }
  async upsertChannels(_entityId: string, _data: Partial<ContactChannels>): Promise<ContactChannels> {
    throw new Error('ContactService not implemented — M7a pending');
  }
  async requestOTP(_req: VerifyChannelRequest): Promise<{ delivered: boolean; channel: string }> {
    throw new Error('ContactService not implemented — M7a pending');
  }
  async confirmOTP(_req: ConfirmChannelRequest): Promise<{ verified: boolean; channel: string }> {
    throw new Error('ContactService not implemented — M7a pending');
  }
  async removeChannel(_entityId: string, _channel: 'whatsapp' | 'telegram' | 'email'): Promise<void> {
    throw new Error('ContactService not implemented — M7a pending');
  }
}
