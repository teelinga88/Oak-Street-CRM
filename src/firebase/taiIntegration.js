/**
 * TAI TMS Integration — Oak Street Logistics CRM
 * ================================================
 * This file is a placeholder for the TAI TMS API integration.
 * When the integration is ready, this module will:
 *
 * 1. SHIPMENT COUNTS PER ACCOUNT (monthly)
 *    - Query TAI TMS API for all shipments with status "Delivered"
 *    - Group by account name / shipper ID
 *    - Count shipments per account for the current month
 *    - Write results to Firestore: accounts/{id}.shipmentsThisMonth
 *    - Write last shipment date: accounts/{id}.lastShipmentDate
 *    - Run on a schedule (e.g. daily via a Cloud Function or cron job)
 *
 * 2. ACCOUNT SORTING
 *    - Accounts with shipmentsThisMonth > 0 sort first, highest to lowest
 *    - Accounts with shipmentsThisMonth = 0 sort alphabetically after
 *
 * 3. 90-DAY NO-SHIPMENT ALERT
 *    - If lastShipmentDate is more than 90 days ago (or null), flag the account
 *    - Show warning badge on account list row
 *    - Show alert in account detail panel
 *    - Auto-generate a follow-up reminder for the rep
 *
 * 4. NETWORK LEADS (auto-create from TAI)
 *    - When a new shipper/receiver appears on a TAI load
 *      that is NOT already in the CRM accounts list,
 *      auto-create a Network Lead in the rep's pipeline
 *      and assign via round robin: Alex → Bobby → Bryan → Charles → repeat
 *
 * 5. FIELDS ADDED TO ACCOUNT DOCUMENTS WHEN INTEGRATED:
 *    - shipmentsThisMonth: number   (delivered shipments this calendar month)
 *    - lastShipmentDate: string     (ISO date of most recent delivered shipment)
 *    - taiShipperId: string         (TAI internal shipper/customer ID for matching)
 *
 * HOW TO INTEGRATE:
 * -----------------
 * 1. Obtain TAI TMS API credentials from Oak Street admin
 * 2. Store credentials in Firebase environment config (never in code)
 * 3. Create a Firebase Cloud Function that runs on a daily schedule
 * 4. In that function, call getTAIShipmentCounts() below and write to Firestore
 * 5. Uncomment and implement the functions below
 *
 * CONTACT: Alex Teeling / Bobby O'Brien for TAI API access
 */

// ── Placeholder functions (implement when TAI API is available) ────────────

/**
 * Fetch delivered shipment counts from TAI TMS for current month
 * @returns {Promise<Array<{accountName: string, taiShipperId: string, count: number, lastShipmentDate: string}>>}
 */
export async function getTAIShipmentCounts() {
  // TODO: implement TAI API call
  // const response = await fetch('https://tai-api-endpoint/shipments', {
  //   method: 'GET',
  //   headers: { 'Authorization': `Bearer ${process.env.TAI_API_KEY}` },
  //   params: { status: 'Delivered', month: currentMonth, year: currentYear }
  // });
  // return response.json();
  throw new Error('TAI TMS integration not yet implemented');
}

/**
 * Sync TAI shipment counts into Firestore accounts
 * Call this from a Cloud Function on a daily schedule
 */
export async function syncShipmentsToFirestore(db) {
  // TODO: implement sync logic
  // 1. const counts = await getTAIShipmentCounts();
  // 2. For each count, find matching account in Firestore by taiShipperId or name
  // 3. Update account: { shipmentsThisMonth: count, lastShipmentDate: date }
  throw new Error('TAI TMS integration not yet implemented');
}

/**
 * Check for accounts with no shipments in 90+ days and create follow-up alerts
 * Call this from a Cloud Function on a daily schedule
 */
export async function check90DayAlerts(db) {
  // TODO: implement 90-day check
  // 1. Query all accounts where lastShipmentDate < (today - 90 days)
  // 2. For each, check if a 90-day alert follow-up already exists
  // 3. If not, create one: addFollowup({ notes: '⚠ No shipments in 90+ days', ... })
  throw new Error('TAI TMS integration not yet implemented');
}

/**
 * Auto-create Network Leads from new TAI shippers not in CRM
 * Call this from a Cloud Function triggered by new TAI loads
 */
export async function autoCreateNetworkLeads(db, taiLoad) {
  // TODO: implement network lead creation
  // 1. Extract shipper + receiver from taiLoad
  // 2. Check if each exists in Firestore accounts
  // 3. If not, create a new deal (Network Lead) and assign via round robin
  // Round robin order: Alex → Bobby → Bryan → Charles → repeat
  throw new Error('TAI TMS integration not yet implemented');
}
