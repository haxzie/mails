import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail, parseContactsCsv } from "./contacts";

describe("email validation", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("ada@example.com")).toBe(true);
    expect(isValidEmail("ada+tag@mail.example.co.uk")).toBe(true);
  });

  it("rejects junk", () => {
    for (const value of ["", "ada", "ada@", "@example.com", "a b@c.com", "a@b"]) {
      expect(isValidEmail(value)).toBe(false);
    }
  });

  it("normalizes case and spacing", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("CSV import", () => {
  it("maps known columns and keeps the rest as properties", () => {
    const { contacts, errors } = parseContactsCsv(
      'email,First Name,last_name,plan\nada@example.com,Ada,Lovelace,pro\n',
    );
    expect(errors).toEqual([]);
    expect(contacts).toEqual([
      {
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        properties: { plan: "pro" },
        source: "import",
      },
    ]);
  });

  it("handles quoted fields with commas", () => {
    const { contacts } = parseContactsCsv(
      'email,company\nada@example.com,"Acme, Inc"\n',
    );
    expect(contacts[0]?.properties).toEqual({ company: "Acme, Inc" });
  });

  it("reports bad rows without dropping the good ones", () => {
    const { contacts, errors } = parseContactsCsv(
      "email\nada@example.com\nnot-an-email\n",
    );
    expect(contacts).toHaveLength(1);
    expect(errors[0]).toContain("Row 3");
  });

  it("refuses a file with no email column", () => {
    const { contacts, errors } = parseContactsCsv("name\nAda\n");
    expect(contacts).toHaveLength(0);
    expect(errors[0]).toContain("email");
  });
});
