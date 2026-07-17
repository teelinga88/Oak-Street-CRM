import { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';

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
