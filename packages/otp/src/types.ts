export type OTPChannel = 'sms' | 'whatsapp' | 'ussd' | 'voice';

export interface OTPConfig {
  length: 6;
  ttl_seconds: 600;
  max_attempts: 5;
  lockout_seconds: 900;
  resend_cooldown: 60;
}

export interface OTPSendResult {
  sent: boolean;
  channel: OTPChannel;
  message_id?: string;
  expires_at: number;
}

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string;  // E.164: +234...
  carrier?: 'mtn' | 'airtel' | 'glo' | '9mobile' | 'unknown';
}

export interface OTPProvider {
  sendOTP(phone: string, message: string, options?: { channel?: OTPChannel }): Promise<OTPSendResult>;
  verifyOTP(phone: string, code: string, tenantId: string): Promise<boolean>;
}
