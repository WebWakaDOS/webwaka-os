/** Identity verification types for @webwaka/identity */

export interface ConsentRecord {
  id: string;
  user_id: string;
  tenant_id: string;
  data_type: 'BVN' | 'NIN' | 'CAC' | 'FRSC';
  purpose: string;
  consented_at: number;
  withdrawn_at?: number;
}

export interface BVNVerifyResult {
  verified: boolean;
  full_name: string;
  phone_match: boolean;
  dob_match?: boolean;
  face_match_score?: number;
  provider: 'prembly' | 'paystack';
}

export interface NINVerifyResult {
  verified: boolean;
  full_name: string;
  gender: string;
  dob: string;
  face_match_score?: number;
  provider: 'prembly' | 'nimc';
}

export interface CACVerifyResult {
  verified: boolean;
  company_name: string;
  rc_number: string;
  status: 'active' | 'inactive';
  registration_date: string;
  provider: 'prembly';
}

export interface FRSCVerifyResult {
  verified: boolean;
  full_name: string;
  license_number: string;
  expiry_date: string;
  vehicle_class: string[];
  status: 'valid' | 'expired' | 'suspended';
  provider: 'prembly';
}

export interface IdentityProvider {
  verifyBVN(bvn: string, consent: ConsentRecord): Promise<BVNVerifyResult>;
  verifyNIN(nin: string, consent: ConsentRecord): Promise<NINVerifyResult>;
  verifyCAC(rcNumber: string, consent: ConsentRecord): Promise<CACVerifyResult>;
  verifyFRSC(licenseNumber: string, consent: ConsentRecord): Promise<FRSCVerifyResult>;
}
