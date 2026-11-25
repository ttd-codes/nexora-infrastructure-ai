/**
 * Security Rule Verification Payloads (Dirty Dozen Specification)
 * Reference test suite documenting expected PERMISSION_DENIED outcomes
 * for unauthorized mutations, shadow fields, privilege escalation, and spoofing.
 */
export const DIRTY_DOZEN_SECURITY_CASES = [
  { name: '01_unauthenticated_asset_read', expected: 'PERMISSION_DENIED' },
  { name: '02_unverified_email_asset_write', expected: 'PERMISSION_DENIED' },
  { name: '03_forged_ownerUid_on_record_create', expected: 'PERMISSION_DENIED' },
  { name: '04_cross_tenant_list_without_owner_filter', expected: 'PERMISSION_DENIED' },
  { name: '05_cross_tenant_user_pii_get', expected: 'PERMISSION_DENIED' },
  { name: '06_self_assigned_admin_role_escalation', expected: 'PERMISSION_DENIED' },
  { name: '07_shadow_update_extra_field_isVerified', expected: 'PERMISSION_DENIED' },
  { name: '08_immutable_ownerUid_or_createdAt_mutation', expected: 'PERMISSION_DENIED' },
  { name: '09_oversized_or_invalid_doc_id_poisoning', expected: 'PERMISSION_DENIED' },
  { name: '10_unbounded_array_or_oversized_string', expected: 'PERMISSION_DENIED' },
  { name: '11_client_forged_server_timestamp', expected: 'PERMISSION_DENIED' },
  { name: '12_orphan_record_referencing_nonexistent_asset', expected: 'PERMISSION_DENIED' },
] as const;
