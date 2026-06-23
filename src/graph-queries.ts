import type { Link, ProjectState, Thought } from "./types";

export type GraphConnectionRole = "parent" | "child" | "related";

export type GraphConnection = {
  linkId: string;
  linkName: string;
  thought: Thought;
  role: GraphConnectionRole;
};

export type AncestorEntry = {
  thought: Thought;
  depth: number;
  childId: string;
};

export type DescendantEntry = {
  thought: Thought;
  depth: number;
  parentId: string;
};

/**
 * Read-only graph operations used by the UI.
 *
 * A state getter is used instead of capturing one ProjectState object because
 * imports, project switches, undo, and snapshot restore replace the state
 * object. Each query therefore sees the current state without requiring cache
 * invalidation in the application controller.
 */
export function createGraphQueries(getState: () => ProjectState) {
  const getThought = (id: string | null | undefined): Thought | null => {
    if (!id) return null;
    return getState().thoughts.find((thought) => thought.id === id) || null;
  };

  const getParentThoughts = (id: string): Thought[] => {
    // Hierarchical links point from the parent (`from`) to the child (`to`).
    return getState().links
      .filter((link) => link.type !== "related" && link.to === id)
      .map((link) => getThought(link.from))
      .filter(isThought);
  };

  const getChildThoughts = (id: string): Thought[] => {
    return getState().links
      .filter((link) => link.type !== "related" && link.from === id)
      .map((link) => getThought(link.to))
      .filter(isThought);
  };

  const getRelatedThoughts = (id: string): Thought[] => {
    // Related links are semantically undirected even though they are stored
    // with `from` and `to` fields.
    return getState().links
      .filter((link) => link.type === "related" && (link.from === id || link.to === id))
      .map((link) => getThought(link.from === id ? link.to : link.from))
      .filter(isThought);
  };

  const getAncestorEntries = (id: string, maxDepth = 2): AncestorEntry[] => {
    const entries: AncestorEntry[] = [];
    const visited = new Set([id]);
    let frontier = [{ id, depth: 0 }];

    // Breadth-first traversal keeps depth meaningful and the visited set makes
    // malformed or intentionally cyclic maps safe to inspect.
    while (frontier.length) {
      const next: { id: string; depth: number }[] = [];
      frontier.forEach((item) => {
        if (item.depth >= maxDepth) return;
        getState().links
          .filter((link) => link.type !== "related" && link.to === item.id)
          .forEach((link) => {
            const thought = getThought(link.from);
            if (!thought || visited.has(thought.id)) return;
            visited.add(thought.id);
            entries.push({ thought, depth: item.depth + 1, childId: item.id });
            next.push({ id: thought.id, depth: item.depth + 1 });
          });
      });
      frontier = next;
    }

    return entries;
  };

  const getDescendantEntries = (id: string, maxDepth = 3): DescendantEntry[] => {
    const entries: DescendantEntry[] = [];
    const visited = new Set([id]);
    let frontier = [{ id, depth: 0 }];

    while (frontier.length) {
      const next: { id: string; depth: number }[] = [];
      frontier.forEach((item) => {
        if (item.depth >= maxDepth) return;
        getState().links
          .filter((link) => link.type !== "related" && link.from === item.id)
          .forEach((link) => {
            const thought = getThought(link.to);
            if (!thought || visited.has(thought.id)) return;
            visited.add(thought.id);
            entries.push({ thought, depth: item.depth + 1, parentId: item.id });
            next.push({ id: thought.id, depth: item.depth + 1 });
          });
      });
      frontier = next;
    }

    return entries;
  };

  const getSiblingThoughts = (id: string): Thought[] => {
    const siblingIds = new Set<string>();
    getParentThoughts(id).forEach((parent) => {
      getChildThoughts(parent.id).forEach((child) => {
        if (child.id !== id) siblingIds.add(child.id);
      });
    });
    return [...siblingIds].map(getThought).filter(isThought);
  };

  const getConnections = (id: string | null | undefined): GraphConnection[] => {
    if (!id) return [];
    return getState().links
      .filter((link) => link.from === id || link.to === id)
      .map((link): GraphConnection | null => toConnection(link, id, getThought))
      .filter(isConnection);
  };

  const getConnectedThoughts = (id: string): Thought[] => {
    return getConnections(id).map((connection) => connection.thought);
  };

  const isInboxThought = (id: string): boolean => {
    // Inbox membership is derived, not persisted: a thought stays in the inbox
    // until its first connection is created.
    return !getState().links.some((link) => link.from === id || link.to === id);
  };

  const getGraphThoughts = (): Thought[] => {
    return getState().thoughts.filter((thought) => !isInboxThought(thought.id));
  };

  const getInboxThoughts = (): Thought[] => {
    return getState().thoughts.filter((thought) => isInboxThought(thought.id));
  };

  const getThoughtByTitle = (title: unknown): Thought | null => {
    const normalized = String(title || "").trim().toLowerCase();
    if (!normalized) return null;
    return getState().thoughts.find((thought) => thought.title.toLowerCase() === normalized) || null;
  };

  const hasLinkBetween = (firstId: string, secondId: string): boolean => {
    return getState().links.some(
      (link) =>
        (link.from === firstId && link.to === secondId) ||
        (link.from === secondId && link.to === firstId),
    );
  };

  return {
    getAncestorEntries,
    getChildThoughts,
    getConnectedThoughts,
    getConnections,
    getDescendantEntries,
    getGraphThoughts,
    getInboxThoughts,
    getParentThoughts,
    getRelatedThoughts,
    getSiblingThoughts,
    getThought,
    getThoughtByTitle,
    hasLinkBetween,
    isInboxThought,
  };
}

export function uniqueThoughts(thoughts: Array<Thought | null | undefined>): Thought[] {
  const seen = new Set<string>();
  return thoughts.filter((thought): thought is Thought => {
    if (!thought || seen.has(thought.id)) return false;
    seen.add(thought.id);
    return true;
  });
}

function toConnection(
  link: Link,
  activeId: string,
  getThought: (id: string) => Thought | null,
): GraphConnection | null {
  if (link.type === "related") {
    const thought = getThought(link.from === activeId ? link.to : link.from);
    return thought
      ? { linkId: link.id, linkName: link.name || "", thought, role: "related" }
      : null;
  }

  const isParent = link.to === activeId;
  const thought = getThought(isParent ? link.from : link.to);
  return thought
    ? {
        linkId: link.id,
        linkName: link.name || "",
        thought,
        role: isParent ? "parent" : "child",
      }
    : null;
}

function isThought(thought: Thought | null): thought is Thought {
  return Boolean(thought);
}

function isConnection(connection: GraphConnection | null): connection is GraphConnection {
  return Boolean(connection);
}
