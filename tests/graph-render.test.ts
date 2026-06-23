import { describe, expect, it } from "vitest";

import { getLinkGroupPresentation, type LinkGroupPresentationOptions } from "../src/graph-render";

const baseOptions: LinkGroupPresentationOptions = {
  useCalmDepthStyles: false,
  isActiveLink: false,
  isSelectedLink: false,
  isPreviewLink: false,
  isAppearing: false,
  isLeaving: false,
  isFocusLink: false,
  hasSelectedThought: true,
  depthOpacity: 0.42,
};

describe("getLinkGroupPresentation", () => {
  it.each([
    { isFocusLink: true },
    { isPreviewLink: true },
    { isFocusLink: false },
    { isActiveLink: true },
    { isSelectedLink: true },
  ])("keeps flat-mode links at normal opacity for %o", (overrides) => {
    const presentation = getLinkGroupPresentation({ ...baseOptions, ...overrides });

    expect(presentation.opacity).toBe(1);
    expect(presentation.className).not.toContain(" context");
    expect(presentation.className).not.toContain(" dimmed");
    expect(presentation.className).not.toContain(" preview");
  });

  it("retains Calm-mode depth fading", () => {
    const presentation = getLinkGroupPresentation({
      ...baseOptions,
      useCalmDepthStyles: true,
      isFocusLink: true,
    });

    expect(presentation).toEqual({
      className: "link-group context",
      opacity: 0.42,
    });
  });

  it("only fades a leaving link as a transition in flat mode", () => {
    const presentation = getLinkGroupPresentation({
      ...baseOptions,
      isLeaving: true,
    });

    expect(presentation).toEqual({
      className: "link-group leaving",
      opacity: 1,
    });
  });
});
