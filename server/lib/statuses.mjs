// The normalized statuses the portal understands, per kind of check.
export const STATUSES = {
  identity: ['pending', 'passed', 'review', 'failed'],
  accreditation: ['pending', 'verified', 'review', 'rejected'],
  aml: ['pending', 'clear', 'potential_match']
};
export const CHECKS = Object.keys(STATUSES);
