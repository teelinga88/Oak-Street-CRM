import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, orderBy, limit, setDoc
} from 'firebase/firestore';
import { db, functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';

// ── Accounts ──────────────────────────────────────────────────────────────
export function useAccounts(repName, isManager = false) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repName) return;
    let q;
    if (isManager) {
      q = query(collection(db, 'accounts'), orderBy('name'));
    } else {
      q = query(collection(db, 'accounts'), where('rep', '==', repName), orderBy('name'));
    }
    const unsub = onSnapshot(q, snap => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [repName, isManager]);

  async function addAccount(data) {
    return addDoc(collection(db, 'accounts'), {
      ...data,
      createdAt: serverTimestamp(),
      lastContact: null,
      activities: []
    });
  }

  async function updateAccount(id, data) {
    return updateDoc(doc(db, 'accounts', id), data);
  }

  async function deleteAccount(id) {
    return deleteDoc(doc(db, 'accounts', id));
  }

  return { accounts, loading, addAccount, updateAccount, deleteAccount };
}

// ── Deals / Prospects ─────────────────────────────────────────────────────
export function useDeals(repName, isManager = false) {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repName) return;
    let q;
    if (isManager) {
      q = query(collection(db, 'deals'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'deals'), where('rep', '==', repName), orderBy('createdAt', 'desc'));
    }
    const unsub = onSnapshot(q, snap => {
      setDeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [repName, isManager]);

  async function addDeal(data) {
    return addDoc(collection(db, 'deals'), {
      ...data,
      createdAt: serverTimestamp(),
      activities: data.activities || []
    });
  }

  async function updateDeal(id, data) {
    return updateDoc(doc(db, 'deals', id), data);
  }

  async function deleteDeal(id) {
    return deleteDoc(doc(db, 'deals', id));
  }

  return { deals, loading, addDeal, updateDeal, deleteDeal };
}

// ── Follow-ups ────────────────────────────────────────────────────────────
export function useFollowups(repName, isManager = false) {
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repName) return;
    let q;
    if (isManager) {
      q = query(collection(db, 'followups'), orderBy('dueDate'));
    } else {
      q = query(collection(db, 'followups'), where('rep', '==', repName), orderBy('dueDate'));
    }
    const unsub = onSnapshot(q, snap => {
      setFollowups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [repName, isManager]);

  async function addFollowup(data) {
    return addDoc(collection(db, 'followups'), { ...data, done: false, createdAt: serverTimestamp() });
  }

  async function updateFollowup(id, data) {
    return updateDoc(doc(db, 'followups', id), data);
  }

  async function deleteFollowup(id) {
    return deleteDoc(doc(db, 'followups', id));
  }

  return { followups, loading, addFollowup, updateFollowup, deleteFollowup };
}

// ── Bucket leads ──────────────────────────────────────────────────────────
export function useBucket(repName) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repName) return;
    const q = query(collection(db, 'bucket'), where('rep', '==', repName), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [repName]);

  async function addLead(data) {
    return addDoc(collection(db, 'bucket'), { ...data, attempts: 0, notes: [], createdAt: serverTimestamp() });
  }

  async function updateLead(id, data) {
    return updateDoc(doc(db, 'bucket', id), data);
  }

  async function deleteLead(id) {
    return deleteDoc(doc(db, 'bucket', id));
  }

  return { leads, loading, addLead, updateLead, deleteLead };
}

// ── Network Lead dismissals ────────────────────────────────────────────────
// When a rep deletes a Network Lead prospect (deciding it's not worth
// pursuing), we don't keep the deal around — but without SOME record, the
// backend sync would just re-detect the same shipper/receiver company from
// TAI's data on its next run and re-add it as if brand new. This writes a
// lightweight, invisible-to-the-UI record so the backend can permanently
// skip that company going forward, without cluttering the actual pipeline.
export async function dismissNetworkLead(companyName) {
  if (!companyName) return;
  return addDoc(collection(db, 'dismissedNetworkLeads'), {
    company: companyName,
    dismissedAt: serverTimestamp(),
  });
}

// ── Celebrations (shared "Closed Won" broadcast) ────────────────────────────
// When any rep closes a deal, we drop a lightweight doc here so every other
// connected rep's browser can react in real time (fireworks + a sound) and
// celebrate together, without needing a backend push/notification service.
// Only the single most recent doc is ever read, and each client only reacts
// to it once and only if it's fresh — so loading the app later doesn't replay
// old celebrations.
export function useCelebrations() {
  const [celebration, setCelebration] = useState(null);

  useEffect(() => {
    const mountedAt = Date.now();
    const seen = new Set();
    const q = query(collection(db, 'celebrations'), orderBy('createdAt', 'desc'), limit(1));
    const unsub = onSnapshot(q, snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        if (seen.has(change.doc.id)) return;
        seen.add(change.doc.id);
        const data = change.doc.data();
        const ts = data.createdAt?.toDate?.()?.getTime() || Date.now();
        // Ignore anything older than 15s — either a historical doc replayed
        // on first load, or a celebration that already finished elsewhere.
        if (Date.now() - ts > 15000) return;
        setCelebration({ rep: data.rep, account: data.account, id: change.doc.id, firedAt: mountedAt + Math.random() });
      });
    });
    return unsub;
  }, []);

  return celebration;
}

export async function addCelebration(data) {
  return addDoc(collection(db, 'celebrations'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// ── Lead Criteria (ZoomInfo cold-call sourcing) ────────────────────────────
// One doc per rep, keyed by their email (matches TEAM_ROSTER keys), storing
// the search criteria used by the weekly ZoomInfo bucket-refill Cloud
// Function. Reps set/edit this themselves from the Cold Call Bucket view.
export function useLeadCriteria(repEmail) {
  const [criteria, setCriteria] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!repEmail) { setLoading(false); return; }
    const ref = doc(db, 'leadCriteria', repEmail.toLowerCase());
    const unsub = onSnapshot(ref, snap => {
      setCriteria(snap.exists() ? snap.data() : null);
      setLoading(false);
    });
    return unsub;
  }, [repEmail]);

  async function saveLeadCriteria(data) {
    if (!repEmail) return;
    const ref = doc(db, 'leadCriteria', repEmail.toLowerCase());
    return setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  }

  return { criteria, loading, saveLeadCriteria };
}

// ── On-demand Cold Call Bucket refill ──────────────────────────────────────
// Calls the requestBucketRefill Cloud Function. That function enforces
// server-side that the rep's bucket is completely empty (0 leads) before
// pulling anything from ZoomInfo — a rep with leads still in their bucket,
// even just a few, gets a rejected/thrown error and must wait for the
// normal Monday 6am auto-refill instead. Returns { added } on success, or
// throws (err.message holds the human-readable reason) on failure.
export async function requestBucketRefill() {
  const callable = httpsCallable(functions, 'requestBucketRefill');
  const result = await callable();
  return result.data;
}

// ── ZoomInfo Industry lookup (for the Lead Criteria autocomplete) ─────────
// Fetches ZoomInfo's real industry taxonomy (~190 industries + sub-industries)
// via the getZoomInfoLookupValues callable. Cached in module scope so it's
// only fetched once per page load no matter how many times the modal opens.
let _zoomInfoIndustriesCache = null;
export async function getZoomInfoIndustries() {
  if (_zoomInfoIndustriesCache) return _zoomInfoIndustriesCache;
  const callable = httpsCallable(functions, 'getZoomInfoLookupValues');
  const result = await callable({ field: 'industries' });
  const values = (result.data && result.data.values) || [];
  _zoomInfoIndustriesCache = values.map(v => ({ id: v.id, name: v.attributes?.name || '' })).filter(v => v.name);
  return _zoomInfoIndustriesCache;
}
