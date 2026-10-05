import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";

const env = await initializeTestEnvironment({ projectId: "demo-cafe",
  firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") } });
await env.clearFirestore();
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), "staff/barista1"), { name: "Barista" }); });

const alice = env.authenticatedContext("alice").firestore();
const bob = env.authenticatedContext("bob").firestore();
const staff = env.authenticatedContext("barista1").firestore();
const anon = env.unauthenticatedContext().firestore();
const order = (ref, uid, extra = {}) => ({ ref, at: Date.now(), createdAt: serverTimestamp(), uid, mode: "table", detail: "4", name: "Alice",
  note: "", total: 30, items: [{ id: "latte", size: "M", qty: 1, opts: {} }], status: "new", times: {}, done: [], source: "web", lang: "fr", ...extra });

let pass = 0, fail = 0;
const check = async (label, p) => { try { await p; pass++; console.log("  ✓", label); } catch (e) { fail++; console.log("  ✗", label, e.message); } };

await check("customer creates own order", assertSucceeds(setDoc(doc(alice, "orders/A1"), order("A1", "alice"))));
await check("signed-out user cannot create", assertFails(setDoc(doc(anon, "orders/X1"), order("X1", "nobody"))));
await check("cannot create order for another uid", assertFails(setDoc(doc(alice, "orders/A2"), order("A2", "bob"))));
await check("cannot create already-'ready' order", assertFails(setDoc(doc(alice, "orders/A3"), order("A3", "alice", { status: "ready" }))));
await check("cannot fake creation time", assertFails(setDoc(doc(alice, "orders/A4"), order("A4", "alice", { createdAt: new Date(0) }))));
await check("cannot add unknown fields", assertFails(setDoc(doc(alice, "orders/A5"), order("A5", "alice", { paid: true }))));
await check("cannot submit empty order", assertFails(setDoc(doc(alice, "orders/A6"), order("A6", "alice", { items: [] }))));
await check("customer cannot pose as counter", assertFails(setDoc(doc(alice, "orders/A7"), order("A7", "alice", { source: "counter" }))));
await check("doc id must match ref", assertFails(setDoc(doc(alice, "orders/A8"), order("ZZ", "alice"))));
await check("customer reads own order", assertSucceeds(getDoc(doc(alice, "orders/A1"))));
await check("other customer cannot read it", assertFails(getDoc(doc(bob, "orders/A1"))));
await check("customer query on own uid", assertSucceeds(getDocs(query(collection(alice, "orders"), where("uid", "==", "alice")))));
await check("customer cannot list all orders", assertFails(getDocs(collection(alice, "orders"))));
await check("customer cannot change status", assertFails(updateDoc(doc(alice, "orders/A1"), { status: "served" })));
await check("customer cannot overwrite (re-create) order", assertFails(setDoc(doc(bob, "orders/A1"), order("A1", "bob"))));
await check("staff lists all orders", assertSucceeds(getDocs(collection(staff, "orders"))));
await check("staff moves order to preparing", assertSucceeds(updateDoc(doc(staff, "orders/A1"), { status: "preparing", "times.preparing": Date.now() })));
await check("staff strikes an item", assertSucceeds(updateDoc(doc(staff, "orders/A1"), { done: [0] })));
await check("staff cannot change price", assertFails(updateDoc(doc(staff, "orders/A1"), { total: 1 })));
await check("staff cannot set unknown status", assertFails(updateDoc(doc(staff, "orders/A1"), { status: "lost" })));
await check("nobody deletes orders", assertFails(deleteDoc(doc(staff, "orders/A1"))));
await check("staff creates counter order", assertSucceeds(setDoc(doc(staff, "orders/C1"), order("C1", "barista1", { source: "counter" }))));
await check("staff reads own staff doc", assertSucceeds(getDoc(doc(staff, "staff/barista1"))));
await check("customer cannot make itself staff", assertFails(setDoc(doc(alice, "staff/alice"), { name: "x" })));
await check("customer cannot read staff list", assertFails(getDoc(doc(alice, "staff/barista1"))));

// ---------- points can only be credited once per order ----------
await check("staff marks served + pointsAwarded", assertSucceeds(updateDoc(doc(staff, "orders/A1"), { status: "served", pointsAwarded: true })));
await check("pointsAwarded cannot be switched off", assertFails(updateDoc(doc(staff, "orders/A1"), { pointsAwarded: false })));
await check("customer cannot set pointsAwarded", assertFails(updateDoc(doc(alice, "orders/A1"), { pointsAwarded: true })));

// ---------- bookings ----------
const booking = (code, uid, extra = {}) => ({ code, at: Date.now(), createdAt: serverTimestamp(), uid, name: "Alice", phone: "0600000000",
  date: "2026-10-10", time: "15:00", guests: 2, type: "table", notes: "", status: "pending", lang: "fr", ...extra });
await check("customer creates booking", assertSucceeds(setDoc(doc(alice, "bookings/R1"), booking("R1", "alice"))));
await check("booking for another uid refused", assertFails(setDoc(doc(alice, "bookings/R2"), booking("R2", "bob"))));
await check("pre-confirmed booking refused", assertFails(setDoc(doc(alice, "bookings/R3"), booking("R3", "alice", { status: "confirmed" }))));
await check("41 guests refused", assertFails(setDoc(doc(alice, "bookings/R4"), booking("R4", "alice", { guests: 41 }))));
await check("guests as text refused", assertFails(setDoc(doc(alice, "bookings/R5"), booking("R5", "alice", { guests: "2" }))));
await check("bad phone refused", assertFails(setDoc(doc(alice, "bookings/R6"), booking("R6", "alice", { phone: "<script>" }))));
await check("bad date format refused", assertFails(setDoc(doc(alice, "bookings/R7"), booking("R7", "alice", { date: "demain" }))));
await check("unknown booking type refused", assertFails(setDoc(doc(alice, "bookings/R8"), booking("R8", "alice", { type: "vip" }))));
await check("customer reads own booking", assertSucceeds(getDoc(doc(alice, "bookings/R1"))));
await check("other customer cannot read booking", assertFails(getDoc(doc(bob, "bookings/R1"))));
await check("customer cannot confirm own booking", assertFails(updateDoc(doc(alice, "bookings/R1"), { status: "confirmed" })));
await check("customer cannot change booking date", assertFails(updateDoc(doc(alice, "bookings/R1"), { date: "2026-12-31" })));
await check("other customer cannot cancel it", assertFails(updateDoc(doc(bob, "bookings/R1"), { status: "cancelled" })));
await check("staff confirms booking", assertSucceeds(updateDoc(doc(staff, "bookings/R1"), { status: "confirmed", statusAt: Date.now() })));
await check("customer cancels own booking", assertSucceeds(updateDoc(doc(alice, "bookings/R1"), { status: "cancelled", statusAt: Date.now() })));
await check("customer cannot un-cancel", assertFails(updateDoc(doc(alice, "bookings/R1"), { status: "pending" })));
await check("staff lists all bookings", assertSucceeds(getDocs(collection(staff, "bookings"))));
await check("customer cannot list all bookings", assertFails(getDocs(collection(alice, "bookings"))));
await check("nobody deletes bookings", assertFails(deleteDoc(doc(staff, "bookings/R1"))));

// ---------- loyalty ----------
await check("customer cannot give themselves points", assertFails(setDoc(doc(alice, "loyalty/alice"), { points: 1000, orders: 1 })));
await check("staff credits points", assertSucceeds(setDoc(doc(staff, "loyalty/alice"), { points: 3, orders: 1, updatedAt: serverTimestamp() })));
await check("customer reads own points", assertSucceeds(getDoc(doc(alice, "loyalty/alice"))));
await check("customer cannot edit own points", assertFails(updateDoc(doc(alice, "loyalty/alice"), { points: 999 })));
await check("other customer cannot read points", assertFails(getDoc(doc(bob, "loyalty/alice"))));
await check("negative points refused", assertFails(setDoc(doc(staff, "loyalty/bob"), { points: -5, orders: 0 })));
await check("fractional points refused", assertFails(setDoc(doc(staff, "loyalty/bob"), { points: 2.5, orders: 0 })));
await check("extra loyalty fields refused", assertFails(setDoc(doc(staff, "loyalty/bob"), { points: 1, orders: 0, tier: "Gold" })));
await check("staff lists loyalty", assertSucceeds(getDocs(collection(staff, "loyalty"))));
await check("customer cannot list loyalty", assertFails(getDocs(collection(alice, "loyalty"))));


// ---------- reviews ----------
const review = (uid, extra = {}) => ({ uid, createdAt: serverTimestamp(), at: Date.now(), rating: 5, name: "Alice",
  text: "Excellent café, service rapide.", lang: "fr", status: "pending", ...extra });
const anonVisitor = env.unauthenticatedContext().firestore();
await check("customer can check own (missing) review slot", assertSucceeds(getDoc(doc(alice, "reviews/alice"))));
await check("customer cannot peek at another's review slot", assertFails(getDoc(doc(bob, "reviews/alice"))));
await check("customer cannot review with someone else's order", assertFails(setDoc(doc(bob, "reviews/bob"), review("bob", { orderRef: "A1" }))));
await check("review with unknown order refused", assertFails(setDoc(doc(bob, "reviews/bob"), review("bob", { orderRef: "NOPE" }))));
await check("customer reviews with own order (verified)", assertSucceeds(setDoc(doc(alice, "reviews/alice"), review("alice", { orderRef: "A1" }))));
await check("second review refused (no overwrite)", assertFails(setDoc(doc(alice, "reviews/alice"), review("alice", { rating: 1 }))));
await check("review doc id must be own uid", assertFails(setDoc(doc(bob, "reviews/someone"), review("bob"))));
await check("pre-approved review refused", assertFails(setDoc(doc(bob, "reviews/bob"), review("bob", { status: "approved" }))));
await check("rating 6 refused", assertFails(setDoc(doc(bob, "reviews/bob"), review("bob", { rating: 6 }))));
await check("rating 4.5 refused", assertFails(setDoc(doc(bob, "reviews/bob"), review("bob", { rating: 4.5 }))));
await check("too-short text refused", assertFails(setDoc(doc(bob, "reviews/bob"), review("bob", { text: "Bien" }))));
await check("too-long text refused", assertFails(setDoc(doc(bob, "reviews/bob"), review("bob", { text: "x".repeat(601) }))));
await check("fake owner reply refused", assertFails(setDoc(doc(bob, "reviews/bob"), review("bob", { reply: "Merci !" }))));
await check("signed-out visitor cannot post", assertFails(setDoc(doc(anonVisitor, "reviews/x"), review("x"))));
await check("customer reviews without order", assertSucceeds(setDoc(doc(bob, "reviews/bob"), review("bob", { rating: 2, text: "Attente trop longue ce matin." }))));
await check("pending review hidden from public", assertFails(getDoc(doc(anonVisitor, "reviews/alice"))));
await check("pending review hidden from other customers", assertFails(getDoc(doc(bob, "reviews/alice"))));
await check("author sees own pending review", assertSucceeds(getDoc(doc(alice, "reviews/alice"))));
await check("author cannot approve own review", assertFails(updateDoc(doc(alice, "reviews/alice"), { status: "approved" })));
await check("author cannot edit text after posting", assertFails(updateDoc(doc(alice, "reviews/alice"), { text: "Modifié après coup" })));
await check("staff approves review", assertSucceeds(updateDoc(doc(staff, "reviews/alice"), { status: "approved", moderatedAt: Date.now() })));
await check("staff replies", assertSucceeds(updateDoc(doc(staff, "reviews/alice"), { reply: "Merci Alice !", replyAt: Date.now() })));
await check("staff cannot alter rating", assertFails(updateDoc(doc(staff, "reviews/alice"), { rating: 1 })));
await check("staff cannot rewrite the text", assertFails(updateDoc(doc(staff, "reviews/bob"), { text: "Tout était parfait !" })));
await check("approved review readable by anyone", assertSucceeds(getDoc(doc(anonVisitor, "reviews/alice"))));
await check("public query on approved reviews", assertSucceeds(getDocs(query(collection(anonVisitor, "reviews"), where("status", "==", "approved")))));
await check("public cannot list all reviews", assertFails(getDocs(collection(anonVisitor, "reviews"))));
await check("customer cannot delete a review", assertFails(deleteDoc(doc(alice, "reviews/alice"))));
await check("staff deletes spam", assertSucceeds(deleteDoc(doc(staff, "reviews/bob"))));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup(); process.exit(fail ? 1 : 0);
