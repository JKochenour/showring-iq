import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./normalize";

describe("decodeHtmlEntities", () => {
  it("decodes the named entities seen in web-exported spreadsheets", () => {
    expect(decodeHtmlEntities("3Jets&apos; Winterhawk")).toBe("3Jets' Winterhawk");
    expect(decodeHtmlEntities("Smith &amp; Jones")).toBe("Smith & Jones");
    expect(decodeHtmlEntities("&quot;Big&quot; Gun")).toBe('"Big" Gun');
    expect(decodeHtmlEntities("A&nbsp;B")).toBe("A B");
    expect(decodeHtmlEntities("&lt;none&gt;")).toBe("<none>");
  });

  it("decodes numeric and hex entities", () => {
    expect(decodeHtmlEntities("3Jets&#39; Winterhawk")).toBe("3Jets' Winterhawk");
    expect(decodeHtmlEntities("3Jets&#x27; Winterhawk")).toBe("3Jets' Winterhawk");
  });

  it("leaves plain ampersands alone", () => {
    expect(decodeHtmlEntities("Youth 13 & U")).toBe("Youth 13 & U");
    expect(decodeHtmlEntities("Boots & Saddles Tack")).toBe("Boots & Saddles Tack");
  });

  it("leaves unknown entities and control-range codes alone", () => {
    expect(decodeHtmlEntities("R&B; Ranch")).toBe("R&B; Ranch");
    expect(decodeHtmlEntities("bad &#7; bell")).toBe("bad &#7; bell");
  });

  it("decodes exactly one level (double-encoded stays one level encoded)", () => {
    expect(decodeHtmlEntities("3Jets&amp;apos; Winterhawk")).toBe("3Jets&apos; Winterhawk");
  });

  it("is a no-op on strings without an ampersand", () => {
    expect(decodeHtmlEntities("Gunners Special Nite")).toBe("Gunners Special Nite");
  });
});
