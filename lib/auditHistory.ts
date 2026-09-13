// lib/auditHistory.ts
// Device-local audit history — Supabase mein nahi, sirf browser ke
// localStorage mein save hota hai (guest/bina-login audits ke liye).

export interface AuditHistoryEntry {
  auditId: string;
  brandName: string;
  websiteUrl: string;
  createdAt: string;
}

const STORAGE_KEY = 'sthamly_audit_history'; // purani key hi rakhi hai — existing users ki history na tootey
const MAX_ENTRIES = 20; // list bahut lambi na ho jaaye, isliye limit

export function getAuditHistory(): AuditHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addAuditToHistory(entry: AuditHistoryEntry) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getAuditHistory().filter((e) => e.auditId !== entry.auditId);
    const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full ya disabled ho to silently ignore — history
    // feature optional hai, app crash nahi hona chahiye
  }
}

// Ek specific entry history se hatao (delete button ke liye)
export function removeAuditFromHistory(auditId: string) {
  if (typeof window === 'undefined') return;
  try {
    const updated = getAuditHistory().filter((e) => e.auditId !== auditId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

// Poori history ek saath clear karo ("Clear All" button ke liye)
export function clearAuditHistory() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}