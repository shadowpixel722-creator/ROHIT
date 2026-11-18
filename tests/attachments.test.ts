import { describe, expect, it } from "vitest";
import { AttachmentError, checkAttachment, formatBytes, safeFileName } from "@/lib/attachment-check";

const bytes = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
const zip = (folder: string) => bytes(`PK\x03\x04....[Content_Types].xml....${folder}document.xml....`);

describe("checkAttachment (by content, not by name)", () => {
  it("accepts real PDF, Word, PowerPoint, Excel and text files", () => {
    expect(checkAttachment(bytes("%PDF-1.7\n..."), "Worksheet.pdf").mime).toBe("application/pdf");
    expect(checkAttachment(zip("word/"), "Essay.docx").label).toBe("Word");
    expect(checkAttachment(zip("ppt/"), "Slides.PPTX").label).toBe("PowerPoint");
    expect(checkAttachment(zip("xl/"), "Marks.xlsx").label).toBe("Excel");
    expect(checkAttachment(new TextEncoder().encode("Revision list — कोयला"), "list.txt").label).toBe("Text");
  });

  it("rejects a program renamed to .pdf, a zip pretending to be Word, and binary 'text'", () => {
    expect(() => checkAttachment(bytes("MZ\x90\x00 this is an exe"), "notes.pdf")).toThrow(/isn't really a PDF/);
    expect(() => checkAttachment(zip("xl/"), "essay.docx")).toThrow(/isn't really a Word/);
    expect(() => checkAttachment(bytes("abc\x00def"), "a.txt")).toThrow(AttachmentError);
  });

  it("rejects other types, empty files and files over 10 MB", () => {
    expect(() => checkAttachment(bytes("<script>"), "page.html")).toThrow(/can't be attached/);
    expect(() => checkAttachment(bytes("MZ"), "setup.exe")).toThrow(/can't be attached/);
    expect(() => checkAttachment(new Uint8Array(0), "a.pdf")).toThrow(/empty/);
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(bytes("%PDF-"));
    expect(() => checkAttachment(big, "big.pdf")).toThrow(/10 MB/);
  });
});

describe("safeFileName", () => {
  it("drops folders, control and header-breaking characters, and keeps the checked extension", () => {
    expect(safeFileName("../../etc/passwd.pdf", "pdf")).toBe("passwd.pdf");
    expect(safeFileName('C:\\Users\\Asha\\My "notes"\r\n.docx', "docx")).toBe("My notes.docx");
    expect(safeFileName("....pdf", "pdf")).toBe("....pdf".replace(/\.pdf$/, "") + ".pdf");
    expect(safeFileName("", "txt")).toBe("attachment.txt");
    expect(safeFileName("x".repeat(300) + ".pdf", "pdf").length).toBeLessThanOrEqual(104);
  });

  it("formats sizes", () => {
    expect([500, 2048, 3 * 1024 * 1024].map(formatBytes)).toEqual(["500 B", "2 KB", "3.0 MB"]);
  });
});
