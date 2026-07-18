import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import App from "../app/App.jsx";
import { createStorage, STORAGE_KEY } from "../lib/storage/adapter.js";

const seedV2 = {
  accounts: [{ id: "a1", name: "ADCB Current", type: "bank", currency: "AED", openingBalance: 5000 }],
  transactions: [
    { id: "t1", type: "expense", date: "2026-07-10", amount: 120, currency: "AED", accountId: "a1", category: "Groceries", note: "Carrefour" },
  ],
  recurrs: [],
  debts: [],
  budgets: {},
  settings: { base: "AED", rates: { USD: 1, AED: 3.6725, SAR: 3.75, EGP: 50 } },
};

describe("Pocket Ledger UI", () => {
  beforeEach(() => localStorage.clear());

  it("loads and migrates legacy v2 data from the old key", async () => {
    localStorage.setItem("pfm:v2", JSON.stringify(seedV2));
    render(<App storage={createStorage()} />);
    expect(await screen.findByText("ADCB Current")).toBeInTheDocument();
    expect(screen.getAllByText(/Groceries/).length).toBeGreaterThan(0);
    // migrated data was written back under the v3 key with snapshots attached
    await waitFor(() => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) throw new Error("not saved yet");
      const parsed = JSON.parse(saved);
      expect(parsed.schemaVersion).toBe(3);
      expect(parsed.transactions[0].snapshot.EGP).toBe(50);
    });
  });

  it("adds an expense through the sheet and persists it", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...seedV2, schemaVersion: 3 }));
    render(<App storage={createStorage()} />);
    await screen.findByText("ADCB Current");
    fireEvent.click(screen.getByLabelText("Add transaction"));
    fireEvent.click(await screen.findByRole("button", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: /Save expense/i }));
    await waitFor(() => {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(parsed.transactions).toHaveLength(2);
      const added = parsed.transactions[0];
      expect(added.amount).toBe(45);
      expect(added.snapshot.AED).toBeCloseTo(3.6725);
    });
  });

  it("quick-add parses Arabic text and prefills the form", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...seedV2, schemaVersion: 3 }));
    render(<App storage={createStorage()} />);
    await screen.findByText("ADCB Current");
    fireEvent.click(screen.getByLabelText("Add transaction"));
    const field = await screen.findByLabelText("Quick add by voice or text");
    fireEvent.change(field, { target: { value: "غدا ١٢٠ درهم" } });
    fireEvent.click(screen.getByLabelText("Understand and fill the form"));
    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(screen.getByText(/review below, then Save/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Save expense/i }));
    await waitFor(() => {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(parsed.transactions[0].amount).toBe(120);
      expect(parsed.transactions[0].category).toBe("Food & Dining");
      expect(parsed.transactions[0].note).toBe("غدا ١٢٠ درهم");
    });
  });

  it("SMS inbox: paste → approve posts to the matched card, unmatched needs a pick", async () => {
    const seeded = {
      ...seedV2,
      schemaVersion: 3,
      accounts: [
        { ...seedV2.accounts[0], cardDigits: ["8891"] },
        { id: "a4", name: "Visa Signature", type: "credit", currency: "AED", openingBalance: 0, cardDigits: ["4523"] },
      ],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    const batch = [
      "شراء بمبلغ 214.50 درهم لدى CARREFOUR MOE بطاقة ****4523",
      "تم خصم 350.00 جنيه من بطاقتك ****9902 لدى VODAFONE",
    ].join("\n");
    Object.assign(navigator, { clipboard: { readText: async () => batch } });

    // Cold-start entry is the Shortcut hash intake — simulate it on a fresh mount:
    window.location.hash = "#sms=" + encodeURIComponent(batch);
    // re-render to trigger the intake effect on a fresh mount
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    document.body.innerHTML = "";
    render(<App storage={createStorage()} />);

    expect(await screen.findByText("CARREFOUR MOE")).toBeInTheDocument();
    expect(screen.getByText("VODAFONE")).toBeInTheDocument();

    // matched item approves straight away
    const approveButtons = screen.getAllByRole("button", { name: /✓ Approve$/ });
    fireEvent.click(approveButtons[0]);
    await waitFor(() => {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(parsed.pending).toHaveLength(1);
      const tx = parsed.transactions.find((x) => (x.note || "").includes("CARREFOUR"));
      expect(tx.accountId).toBe("a4");
      expect(tx.amount).toBe(214.5);
      expect(tx.category).toBe("Groceries");
    });

    // unmatched: button disabled until an account is picked
    const remaining = screen.getAllByRole("button", { name: /✓ Approve$/ });
    expect(remaining[0]).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Source account for this withdrawal"), { target: { value: "a1" } });
    fireEvent.click(screen.getAllByRole("button", { name: /✓ Approve$/ })[0]);
    await waitFor(() => {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(parsed.pending).toHaveLength(0);
      expect(parsed.transactions.find((x) => (x.note || "").includes("VODAFONE")).accountId).toBe("a1");
    });
    window.location.hash = "";
  });

  it("hide toggle masks amounts", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...seedV2, schemaVersion: 3 }));
    render(<App storage={createStorage()} />);
    await screen.findByText("ADCB Current");
    fireEvent.click(screen.getByLabelText("Hide amounts"));
    expect((await screen.findAllByText("•••••")).length).toBeGreaterThan(0);
  });

  it("deleting a transaction offers Undo", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...seedV2, schemaVersion: 3 }));
    render(<App storage={createStorage()} />);
    await screen.findByText("ADCB Current");
    fireEvent.click(screen.getByText("Activity"));
    fireEvent.click((await screen.findAllByLabelText(/Delete Groceries/))[0]);
    expect(await screen.findByText(/Undo/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Undo/));
    await waitFor(() => {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(parsed.transactions).toHaveLength(1);
    });
  });
});
