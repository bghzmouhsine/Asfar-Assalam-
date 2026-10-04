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
console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup(); process.exit(fail ? 1 : 0);
